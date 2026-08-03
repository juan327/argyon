namespace Argyon.Backend.App.Shared.Services;

public static class DemoModeSetup
{
    public static DemoModeSettings GetSettings(IConfiguration configuration)
    {
        return configuration.GetSection("DemoMode").Get<DemoModeSettings>() ?? new DemoModeSettings();
    }
}
