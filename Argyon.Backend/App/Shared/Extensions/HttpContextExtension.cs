namespace Argyon.Backend.App.Shared.Extensions;

public static class HttpContextExtension
{
    public static Guid? GetUserId(this HttpContext httpContext)
    {
        return httpContext.Items["UserId"] as Guid?;
    }
}