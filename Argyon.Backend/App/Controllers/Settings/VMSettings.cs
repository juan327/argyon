namespace Argyon.Backend.App.Controllers.Settings;

public class VMSettings
{
    public class VMSetRegistrationEnabled
    {
        public bool Enabled { get; set; }
    }

    public class VMSetLimits
    {
        public int? MaxNotesAdministrator { get; set; }
        public int? MaxFoldersAdministrator { get; set; }
        public int? MaxNotesUser { get; set; }
        public int? MaxFoldersUser { get; set; }
    }

    public class VMSetPermissions
    {
        public bool CanManageNotesAdministrator { get; set; }
        public bool CanUseTwoFactorAdministrator { get; set; }
        public bool CanManageNotesUser { get; set; }
        public bool CanUseTwoFactorUser { get; set; }
    }

    public class VMSetContentLimits
    {
        public int? MaxNoteNameCharsAdministrator { get; set; }
        public int? MaxNoteNameCharsUser { get; set; }
        public int? MaxNoteDescriptionCharsAdministrator { get; set; }
        public int? MaxNoteDescriptionCharsUser { get; set; }
        public int? MaxNoteTagsCharsAdministrator { get; set; }
        public int? MaxNoteTagsCharsUser { get; set; }
        public int? MaxNoteDataKbAdministrator { get; set; }
        public int? MaxNoteDataKbUser { get; set; }
        public int? MaxAttachmentFileSizeKbAdministrator { get; set; }
        public int? MaxAttachmentFileSizeKbUser { get; set; }
    }
}
