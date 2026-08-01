namespace Argyon.Backend.App.Shared.Services;

public class RateLimitingSettings
{
    public RateLimitRuleSettings Public { get; set; } = new();
    public RateLimitRuleSettings Authenticated { get; set; } = new();
}

public class RateLimitRuleSettings
{
    public bool Enabled { get; set; } = true;
    public int PermitLimit { get; set; } = 60;
    public int WindowSeconds { get; set; } = 60;
    public int QueueLimit { get; set; } = 0;
}
