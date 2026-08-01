using System.Net;

namespace Argyon.Backend.App.Shared.Middlewares;

public class GenericMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration iConfiguration;

    // script-src needs 'wasm-unsafe-eval' because auth.service.ts derives the KEK client-side via
    // argon2-browser (WebAssembly.instantiate); without it Argon2id can't run and login/unlock breaks.
    // style-src needs 'unsafe-inline' because Angular's emulated view encapsulation and PrimeNG both
    // inject/mutate inline styles at runtime; a stricter policy would break component styling.
    private const string ContentSecurityPolicy =
        "default-src 'self'; " +
        "script-src 'self' 'wasm-unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "font-src 'self' data:; " +
        "connect-src 'self'; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "frame-ancestors 'none'";

    public GenericMiddleware(RequestDelegate next, IConfiguration _iConfiguration)
    {
        this._next = next;
        this.iConfiguration = _iConfiguration;
    }

    public async Task InvokeAsync(HttpContext httpContext)
    {
        var headers = httpContext.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Cross-Origin-Resource-Policy"] = "same-origin";
        headers["Content-Security-Policy"] = ContentSecurityPolicy;

        await _next(httpContext); // Wait for the rest of the API to respond
    }
}