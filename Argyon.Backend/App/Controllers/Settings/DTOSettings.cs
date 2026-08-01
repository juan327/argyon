namespace Argyon.Backend.App.Controllers.Settings;

public class DTOSettings
{
    public class DTOSystemSettings
    {
        public bool RegistrationEnabled { get; set; }
        public bool HasAnyUser { get; set; }
        public long? MaxNotesAdministrator { get; set; }
        public long? MaxFoldersAdministrator { get; set; }
        public long? MaxNotesUser { get; set; }
        public long? MaxFoldersUser { get; set; }
        public bool CanManageNotesAdministrator { get; set; }
        public bool CanUseTwoFactorAdministrator { get; set; }
        public bool CanManageNotesUser { get; set; }
        public bool CanUseTwoFactorUser { get; set; }
        public long? MaxNoteNameCharsAdministrator { get; set; }
        public long? MaxNoteNameCharsUser { get; set; }
        public long? MaxNoteDescriptionCharsAdministrator { get; set; }
        public long? MaxNoteDescriptionCharsUser { get; set; }
        public long? MaxNoteTagsCharsAdministrator { get; set; }
        public long? MaxNoteTagsCharsUser { get; set; }
        public long? MaxNoteDataKbAdministrator { get; set; }
        public long? MaxNoteDataKbUser { get; set; }
        public long? MaxAttachmentFileSizeKbAdministrator { get; set; }
        public long? MaxAttachmentFileSizeKbUser { get; set; }
    }
}
