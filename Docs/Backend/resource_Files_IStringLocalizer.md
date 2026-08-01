# Localization in Argyon.Backend with Resource Files + `IStringLocalizer`

This document describes how backend localization (i18n) is implemented in **Argyon.Backend** (.NET 10 Web API) using **resource files (`.resx`)** together with **`IStringLocalizer`**. The client's language is detected automatically from the `Accept-Language` HTTP header. Only **English** (default) and **Spanish** are supported.

---

## 1. Folder structure

A single shared resource is used for the entire API — one pair of `.resx` files, reused across every feature (`User`, `Note`, `Folder`, `Totp`, `Settings`) instead of one resource per feature. Most identical messages (e.g. "user not authenticated", "internal server error") are shared by many services, so a single resource avoids duplicating keys.

The marker class and its resource files live at the **project root**, not nested under `App/`, because `IStringLocalizer<T>` resolves `.resx` files based on the type's namespace relative to the assembly's root namespace. Keeping the marker class at the root namespace (`Argyon.Backend`) and the `Resources` folder as a root-level sibling avoids any ambiguity in that resolution:

```
Argyon.Backend/
├── Resources/
│   ├── SharedResource.resx        (default language: English)
│   └── SharedResource.es.resx     (Spanish)
├── SharedResource.cs
├── Program.cs
└── App/
    └── ... (controllers, services, entities, etc.)
```

> `SharedResource.cs` is an empty "marker" class used only as a type reference for `IStringLocalizer<T>`. It needs no logic.

```csharp
// SharedResource.cs
namespace Argyon.Backend;

public class SharedResource { }
```

No extra NuGet package is required: `Microsoft.Extensions.Localization` and `RequestLocalizationMiddleware` are already part of the `Microsoft.AspNetCore.App` shared framework that `Microsoft.NET.Sdk.Web` targets. `.resx` files are automatically embedded as resources by the SDK's default item globs (`**/*.resx`), so no `.csproj` changes are needed either.

---

## 2. Creating the resource files (.resx)

Each `.resx` file holds key/value pairs. Keys are semantic, English, PascalCase names (`UserNotAuthenticated`, `InternalServerError`, `NoteCreated`) — never full sentences — and are reused across services whenever the message text is identical between features.

**`Resources/SharedResource.resx`** (default language — English)

| Name | Value |
|---|---|
| `UserNotAuthenticated` | User not authenticated |
| `UserNotFound` | User not found |
| `InternalServerError` | Internal server error |
| `IncorrectPassword` | Incorrect password |
| `NoteCreated` | Note created successfully |
| `FolderNotFound` | Folder not found |
| ... | *(~70 keys total, covering every user-facing message in the API)* |

**`Resources/SharedResource.es.resx`** (Spanish)

| Name | Value |
|---|---|
| `UserNotAuthenticated` | Usuario no autenticado |
| `UserNotFound` | No se ha encontrado el usuario |
| `InternalServerError` | Error interno del servidor |
| `IncorrectPassword` | Contraseña incorrecta |
| `NoteCreated` | Apunte creado correctamente |
| `FolderNotFound` | Carpeta no encontrada |
| ... | *(same key set as the default file)* |

> Both files must stay in sync — every key in `SharedResource.resx` must also exist in `SharedResource.es.resx`, and vice versa. A missing key in `SharedResource.es.resx` silently falls back to the English value (the neutral, no-suffix `.resx` is the fallback resource).

---

## 3. Registering the localization services in `Program.cs`

```csharp
using System.Globalization;
using Microsoft.AspNetCore.Localization;

var builder = WebApplication.CreateBuilder(args);

// 1. Register the localization services, pointing at the "Resources" folder
builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");

// 2. Only English and Spanish are supported
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

    // Only the Accept-Language header is used to pick the culture: if it's missing, or
    // requests a culture that isn't "en"/"es" (nor a variant like "es-PE"), English is used.
    options.RequestCultureProviders.Clear();
    options.RequestCultureProviders.Add(new AcceptLanguageHeaderRequestCultureProvider());
});

var app = builder.Build();

// 3. Localization middleware — must run before any middleware/service that builds a
// localized response (rate limiter, custom middlewares, controllers).
app.UseRequestLocalization();

app.Run();
```

`AddControllersWithViews().AddViewLocalization().AddDataAnnotationsLocalization()` is **not** used: this is a pure Web API (no Razor views), and no `VM*.cs` request model uses Data Annotations (`[Required]`, `[MaxLength]`, etc.) — every request field is validated manually inside the corresponding service, so there's no ModelState-driven validation message to localize.

### How `AcceptLanguageHeaderRequestCultureProvider` works

ASP.NET Core reads the `Accept-Language` header sent by the client, e.g.:

```
Accept-Language: es-PE,es;q=0.9,en;q=0.8
```

It selects the first culture in that list that matches (or has a parent culture that matches) one of the configured `SupportedCultures`. If none match — including when the header is missing entirely — the `DefaultRequestCulture` (English) is used.

> By default, ASP.NET Core uses three providers, in this order: `QueryStringRequestCultureProvider`, `CookieRequestCultureProvider`, and `AcceptLanguageHeaderRequestCultureProvider`. They are cleared and replaced with only the header-based provider, since the requirement is to detect the language exclusively from `Accept-Language`.

---

## 4. Using `IStringLocalizer` in a service

Argyon.Backend is not a Minimal API — it follows the controller + service pattern described in `CLAUDE.md`: controllers are thin pass-throughs, and all business logic (including building the `DTOResponseApi.Message` returned to the client) lives in `*Service.cs` classes. `IStringLocalizer<SharedResource>` is injected via constructor into every service that produces a user-facing message, exactly like any other dependency (`DataContext`, `IConfiguration`, etc.):

```csharp
using Microsoft.Extensions.Localization;

public class UserService : IUserService
{
    private readonly DataContext db;
    private readonly IStringLocalizer<SharedResource> localizer;

    public UserService(DataContext _db, IStringLocalizer<SharedResource> _localizer /*, ...other dependencies */)
    {
        this.db = _db;
        this.localizer = _localizer;
    }

    public async Task<(HttpStatusCode statusCode, DTOGeneric.DTOResponseApi response)> Login(VMUser.VMLogin request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();

        var findUser = this.db.Users.FirstOrDefault(u => u.Username == request.Username);
        if (findUser == null)
        {
            response.Message = this.localizer["InvalidCredentials"];
            return (HttpStatusCode.BadRequest, response);
        }

        // ...

        response.Message = this.localizer["LoginSuccess"];
        return (HttpStatusCode.OK, response);
    }
}
```

`IStringLocalizer<T>`'s indexer returns a `LocalizedString`, which has an implicit conversion to `string` — so it can be assigned directly to `DTOResponseApi.Message` (a plain `string` property) without calling `.Value` explicitly. This also works inside a ternary expression (e.g. picking between two keys based on a boolean flag).

No registration is needed in `Program.cs` for this to work: once `AddLocalization()` has been called, `IStringLocalizer<T>` is resolved automatically by the DI container for any constructor that requests it.

### Special cases: components without normal constructor DI

A few pieces of infrastructure build a `DTOResponseApi` outside the usual "service with constructor-injected dependencies" shape. Each resolves `IStringLocalizer<SharedResource>` differently:

**Custom middleware** — ASP.NET Core injects extra `InvokeAsync` parameters per-request, the same way `DataContext` is already injected here:

```csharp
public async Task InvokeAsync(HttpContext httpContext, DataContext db, IStringLocalizer<SharedResource> localizer)
{
    // ...
    await httpContext.Response.WriteAsJsonAsync(new DTOGeneric.DTOResponseApi
    {
        Message = localizer["AccountBlockedExportOnly"],
    });
}
```

**Static configuration classes** (e.g. rate limiter rejection handling, configured once at startup) have no constructor DI at all — but a per-request callback (like `RateLimiterOptions.OnRejected`) does have access to `HttpContext.RequestServices`, which is resolved by the time each request actually runs:

```csharp
options.OnRejected = async (context, cancellationToken) =>
{
    var localizer = context.HttpContext.RequestServices.GetRequiredService<IStringLocalizer<SharedResource>>();
    await context.HttpContext.Response.WriteAsJsonAsync(new DTOGeneric.DTOResponseApi
    {
        Message = localizer["RateLimitExceeded"],
    }, cancellationToken);
};
```

**`JwtBearerEvents`** callbacks (e.g. `TokenValidated`) follow the same pattern, resolving the localizer from `context.HttpContext.RequestServices` before calling `context.Fail(...)`.

In every case, this only works correctly because `app.UseRequestLocalization()` runs early in the pipeline (right after `var app = builder.Build();`), so `CultureInfo.CurrentUICulture` is already set for the current request before any of these callbacks run.

---

## 5. Testing the API with different languages

```bash
# Spanish
curl -X POST https://localhost:5001/api/user/login \
  -H "Accept-Language: es" \
  -H "Content-Type: application/json" \
  -d '{"username":"nonexistent","password":"wrong"}'
# → { "message": "Usuario y/o contraseña incorrectos", ... }

# Spanish regional variant (falls back to the neutral "es" resource)
curl -X POST https://localhost:5001/api/user/login \
  -H "Accept-Language: es-PE,es;q=0.9,en;q=0.8" \
  -d '...'
# → { "message": "Usuario y/o contraseña incorrectos", ... }

# English (explicit)
curl -X POST https://localhost:5001/api/user/login \
  -H "Accept-Language: en" \
  -d '...'
# → { "message": "Incorrect username and/or password", ... }

# No Accept-Language header at all → falls back to the default (English)
curl -X POST https://localhost:5001/api/user/login -d '...'
# → { "message": "Incorrect username and/or password", ... }

# Unsupported language (e.g. French) → also falls back to the default (English)
curl -X POST https://localhost:5001/api/user/login \
  -H "Accept-Language: fr" \
  -d '...'
# → { "message": "Incorrect username and/or password", ... }
```

---

## 6. Strongly-typed resource access (not used in this project)

.NET supports generating a strongly-typed accessor class (`Resources.Welcome` instead of the magic string `"Welcome"`) by enabling the `ResXFileCodeGenerator` on the `.resx` file in the `.csproj`:

```xml
<ItemGroup>
  <EmbeddedResource Update="Resources\SharedResource.resx">
    <Generator>ResXFileCodeGenerator</Generator>
    <LastGenOutput>SharedResource.Designer.cs</LastGenOutput>
  </EmbeddedResource>
</ItemGroup>
```

Argyon.Backend does **not** enable this. `IStringLocalizer` already provides flexible key-based lookup (`this.localizer["Key"]`), and the generated designer class would be redundant with that — it's normally only useful when you need compile-time-checked resource access outside of `IStringLocalizer` (e.g. from Data Annotations or non-DI code).

---

## 7. Best practices followed in this project

- **Key names are English, semantic identifiers** (`UserNotAuthenticated`, `InternalServerError`), never full sentences.
- **Keys are reused across services** whenever the exact same message applies in more than one feature (e.g. `UserNotFound`, `InternalServerError`, `LimitsUpdated` are each used by several `*Service.cs` files) — this keeps the resource files from growing multiple near-duplicate keys for the same concept.
- **Both `.resx` files are kept in sync** — every key added to `SharedResource.resx` must also be added to `SharedResource.es.resx` with its Spanish translation.
- **The neutral culture (`SharedResource.resx`, no suffix) is English**, and acts as both the default culture and the fallback when a key or a whole culture isn't otherwise resolved.
- **`app.UseRequestLocalization()` runs as early as possible** in the middleware pipeline, before anything that might construct a localized response — including custom middleware, both rate-limiter stages, and authentication/authorization.
- Health-check/liveness-style literals (e.g. the `Ping` endpoint's `"Pong"` response) are **not** localized — they aren't user-facing business messages.

---

## 8. Request flow summary

```
Client sends request
   Header: Accept-Language: es-PE,es;q=0.9,en;q=0.8
        ↓
UseRequestLocalization() middleware
        ↓
AcceptLanguageHeaderRequestCultureProvider
   → compares against SupportedCultures ["en", "es"]
   → selects "es" (or its closest matching culture)
        ↓
CultureInfo.CurrentUICulture = "es"
        ↓
Controller → Service (IStringLocalizer<SharedResource> injected via constructor)
        ↓
this.localizer["InvalidCredentials"]
   → looked up in SharedResource.es.resx
        ↓
Response: { "message": "Usuario y/o contraseña incorrectos" }
```

If `Accept-Language` is missing, or names a culture other than `en`/`es` (e.g. `fr`, `de-DE`), the same flow resolves to `CultureInfo.CurrentUICulture = "en"` and the response is built from the neutral `SharedResource.resx` file instead.

---

## References

- Official documentation: [Globalization and localization in ASP.NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/localization)
- [Request culture providers](https://learn.microsoft.com/aspnet/core/fundamentals/localization#localization-middleware)
