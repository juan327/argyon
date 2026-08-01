namespace Argyon.Backend.App.Controllers.Totp;

public class VMTotp
{
    public class VMSetup
    {
        // Only required when two-factor is already active (see TotpService.Setup)
        public string? AuthHash { get; set; }
    }

    public class VMEnable
    {
        public string AuthHash { get; set; }
        public string Code { get; set; }
    }

    public class VMDisable
    {
        public string AuthHash { get; set; }
        public string Code { get; set; }
    }

    public class VMRegenerateRecoveryCodes
    {
        public string AuthHash { get; set; }
        public string Code { get; set; }
    }

    public class VMVerifyLogin
    {
        public string PendingToken { get; set; }
        public string Code { get; set; }
    }
}
