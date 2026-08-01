namespace Argyon.Backend.App.Controllers.Totp;

public class DTOTotp
{
    public class DTOSetup
    {
        public string Secret { get; set; }
        public string Uri { get; set; }
    }

    public class DTOEnable
    {
        public List<string> RecoveryCodes { get; set; }
    }

    public class DTOStatus
    {
        public bool IsEnabled { get; set; }
    }
}
