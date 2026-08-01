using System.Globalization;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using ApiSqliteDemo.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Localization;
using Microsoft.IdentityModel.Tokens;
using Argyon.Backend.App.Controllers.Attachment;
using Argyon.Backend.App.Controllers.Folder;
using Argyon.Backend.App.Controllers.Info;
using Argyon.Backend.App.Controllers.Note;
using Argyon.Backend.App.Controllers.Settings;
using Argyon.Backend.App.Controllers.Totp;
using Argyon.Backend.App.Controllers.User;
using Argyon.Backend.App.Shared.HostedServices;
using Argyon.Backend.App.Shared.Middlewares;
using Argyon.Backend.App.Shared.Scopeds;
using Argyon.Backend.App.Shared.Services;
using Argyon.Backend.App.Shared.IServices;

var builder = WebApplication.CreateBuilder(args);

var jwtSettings = builder.Configuration.GetSection("Jwt");
var corsSettings = builder.Configuration.GetSection("Cors");

// Add services to the container.
builder.Services.AddControllers();

// Whether the app sits behind a reverse proxy (any proxy, chosen by whoever deploys it, or none
// at all) is a per-deployment decision, so it's driven entirely by the "ForwardedHeaders" section
// in appsettings.json rather than hardcoded here. See ForwardedHeadersSettings for the options.
var forwardedHeadersSettings = ForwardedHeadersSetup.GetSettings(builder.Configuration);

if (forwardedHeadersSettings.Enabled == true)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
        ForwardedHeadersSetup.Configure(options, forwardedHeadersSettings));
}

builder.Services.AddHsts(options =>
{
    options.Preload = false;
    options.IncludeSubDomains = false;
    options.MaxAge = TimeSpan.FromDays(365); // start short, ramp up per hstspreload.org guidance
});

builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");

var supportedCultures = new[]
{
    new CultureInfo("en"),
    new CultureInfo("es"),
};

builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    options.DefaultRequestCulture = new RequestCulture(culture: "en", uiCulture: "en");
    options.SupportedCultures = supportedCultures;
    options.SupportedUICultures = supportedCultures;

    // Only the language indicated in the Accept-Language header is supported: if it is not
    // present or does not match "en"/"es" (nor a variant like "es-PE"), the default (English) is used.
    options.RequestCultureProviders.Clear();
    options.RequestCultureProviders.Add(new AcceptLanguageHeaderRequestCultureProvider());
});

var corsAllowedOrigins = corsSettings.GetSection("AllowedOrigins").Get<string[]>();
var corsEnabled = corsAllowedOrigins is { Length: > 0 };

if (corsEnabled == true)
{
    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(
            policy =>
            {
                policy.WithOrigins(corsAllowedOrigins!)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
    });
}

var databaseSettings = DatabaseSetup.GetSettings(builder.Configuration);

string dbPath = string.Empty;
if (string.Equals(databaseSettings.Provider, "Postgresql", StringComparison.OrdinalIgnoreCase) == false)
{
    string dbDirectory = Path.Combine(AppContext.BaseDirectory, "Data", "Database");
    if (Directory.Exists(dbDirectory) == false)
    {
        Directory.CreateDirectory(dbDirectory);
    }
    dbPath = Path.Combine(dbDirectory, "database.db");
}

builder.Services.AddDbContext<DataContext>(options =>
    DatabaseSetup.Configure(options, databaseSettings, dbPath));

string attachmentsDirectory = Path.Combine(AppContext.BaseDirectory, "Data", "Attachments");
if (Directory.Exists(attachmentsDirectory) == false)
{
    Directory.CreateDirectory(attachmentsDirectory);
}

// Fixed technical ceiling (not the owner-configurable per-role/per-user KB limit enforced by
// ContentLimitService -- that one can change at runtime, this one can't: Kestrel only reads it
// once at startup). Just wide enough that a legitimate upload up to that business limit is never
// hard-rejected by Kestrel with a raw connection reset before AttachmentService gets a chance to
// return a friendly, localized error instead.
var maxAttachmentUploadSizeMb = builder.Configuration.GetSection("Attachments").GetValue<long?>("MaxUploadSizeMb") ?? 500;
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = (maxAttachmentUploadSizeMb * 1024 * 1024) + (1024 * 1024);
});
// MVC's multipart form reader has its own, separate limit (default 128MB) that Kestrel's
// MaxRequestBodySize above does not override.
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = (maxAttachmentUploadSizeMb * 1024 * 1024) + (1024 * 1024);
});

builder.Services.AddScoped<JwtEventsHandler>();

builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<INoteService, NoteService>();
builder.Services.AddScoped<IFolderService, FolderService>();
builder.Services.AddScoped<ITotpService, TotpService>();
builder.Services.AddScoped<ISettingsService, SettingsService>();
builder.Services.AddScoped<IInfoService, InfoService>();
builder.Services.AddScoped<IAttachmentService, AttachmentService>();
builder.Services.AddScoped<INoteLimitService, NoteLimitService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<IContentLimitService, ContentLimitService>();
builder.Services.AddSingleton<ISystemSettingsCache, SystemSettingsCache>();

builder.Services.AddHostedService<StartupTask>();
builder.Services.AddHostedService<BackgroundTask>();

builder.Services.AddRateLimiter(_ => { });

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(options =>
{
    options.EventsType = typeof(JwtEventsHandler);
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,

        ValidIssuer = jwtSettings.GetValue<string>("Issuer"),
        ValidAudience = jwtSettings.GetValue<string>("Audience"),

        IssuerSigningKey = new SymmetricSecurityKey(JwtKeyGenerator.GenerateKey(
            jwtSettings.GetValue<string>("Password") ?? string.Empty,
            jwtSettings.GetValue<string>("Salt") ?? string.Empty))
    };
});

var app = builder.Build();

// Must go before anything that reads the scheme/client IP (Hsts, HttpsRedirection, rate limiter,
// auth cookie handling) so it sees the original request as forwarded by the reverse proxy, not the
// local hop. No-op when "ForwardedHeaders:Enabled" is false (i.e. the app has no proxy in front).
if (forwardedHeadersSettings.Enabled == true)
{
    app.UseForwardedHeaders();
}

if (app.Environment.IsProduction() == true)
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

// Must go before any middleware/service that builds a localized response
// (rate limiter, GenericMiddleware, BlockedUserRestrictionMiddleware, controllers).
app.UseRequestLocalization();

#region Middlewares
app.UseMiddleware<GenericMiddleware>(); // Generic middleware that runs on every request
#endregion

if (corsEnabled == true)
{
    app.UseCors();
}

app.UseRateLimiter(RateLimitingSetup.CreatePublicLimiterOptions(builder.Configuration));

app.UseAuthentication();
app.UseAuthorization();

app.UseRateLimiter(RateLimitingSetup.CreateAuthenticatedLimiterOptions(builder.Configuration));

app.UseMiddleware<BlockedUserRestrictionMiddleware>();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

app.Run();
