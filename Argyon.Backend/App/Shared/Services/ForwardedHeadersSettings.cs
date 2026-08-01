namespace Argyon.Backend.App.Shared.Services;

public class ForwardedHeadersSettings
{
    // When false, X-Forwarded-* headers are ignored entirely: use this when the app is reachable
    // directly, with no reverse proxy in front of it.
    public bool Enabled { get; set; } = false;

    // When true, the immediate connecting peer is always trusted as a proxy, regardless of
    // KnownProxies/KnownNetworks. Needed when the app can sit behind any reverse proxy chosen by
    // whoever deploys it (its IP isn't known in advance, e.g. it's on a Docker/orchestrator network).
    // Only enable this when the app is not directly reachable by untrusted clients (i.e. the proxy
    // is the sole entry point), otherwise clients could spoof their IP/scheme via those headers.
    public bool TrustAnyProxy { get; set; } = false;

    // Individual proxy IPs to trust (e.g. "127.0.0.1", "::1"). Ignored when TrustAnyProxy is true.
    public string[] KnownProxies { get; set; } = [];

    // CIDR ranges of proxies to trust (e.g. "10.0.0.0/8"). Ignored when TrustAnyProxy is true.
    public string[] KnownNetworks { get; set; } = [];

    // Max number of proxy hops to trust in the forwarded headers chain. Null means unlimited.
    public int? ForwardLimit { get; set; } = 1;
}
