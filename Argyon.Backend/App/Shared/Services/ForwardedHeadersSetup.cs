using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace Argyon.Backend.App.Shared.Services;

public static class ForwardedHeadersSetup
{
    public static ForwardedHeadersSettings GetSettings(IConfiguration configuration)
    {
        return configuration.GetSection("ForwardedHeaders").Get<ForwardedHeadersSettings>() ?? new ForwardedHeadersSettings();
    }

    public static void Configure(ForwardedHeadersOptions options, ForwardedHeadersSettings settings)
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.ForwardLimit = settings.ForwardLimit;

        options.KnownProxies.Clear();
        options.KnownIPNetworks.Clear();

        // Trusting every immediate peer as a proxy is a deliberate, explicit opt-in (see
        // ForwardedHeadersSettings.TrustAnyProxy) for deployments where the reverse proxy's IP
        // isn't known ahead of time. Leaving both lists empty otherwise means no proxy is trusted
        // and the headers are ignored, rather than silently falling back to a wide-open default.
        if (settings.TrustAnyProxy == true)
        {
            return;
        }

        foreach (var proxy in settings.KnownProxies)
        {
            if (IPAddress.TryParse(proxy, out var address) == true)
            {
                options.KnownProxies.Add(address);
            }
        }

        foreach (var network in settings.KnownNetworks)
        {
            if (System.Net.IPNetwork.TryParse(network, out var ipNetwork) == true)
            {
                options.KnownIPNetworks.Add(ipNetwork);
            }
        }
    }
}
