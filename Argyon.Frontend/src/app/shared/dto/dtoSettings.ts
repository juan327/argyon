export class DTOSystemSettings {
    registrationEnabled: boolean;
    hasAnyUser: boolean;
    maxNotesAdministrator: number | null;
    maxFoldersAdministrator: number | null;
    maxNotesUser: number | null;
    maxFoldersUser: number | null;
    canManageNotesAdministrator: boolean;
    canUseTwoFactorAdministrator: boolean;
    canManageNotesUser: boolean;
    canUseTwoFactorUser: boolean;
    maxNoteNameCharsAdministrator: number | null;
    maxNoteNameCharsUser: number | null;
    maxNoteDescriptionCharsAdministrator: number | null;
    maxNoteDescriptionCharsUser: number | null;
    maxNoteTagsCharsAdministrator: number | null;
    maxNoteTagsCharsUser: number | null;
    maxNoteDataKbAdministrator: number | null;
    maxNoteDataKbUser: number | null;
    maxAttachmentFileSizeKbAdministrator: number | null;
    maxAttachmentFileSizeKbUser: number | null;

    constructor(registrationEnabled: boolean, hasAnyUser: boolean, maxNotesAdministrator: number | null, maxFoldersAdministrator: number | null, maxNotesUser: number | null, maxFoldersUser: number | null, canManageNotesAdministrator: boolean, canUseTwoFactorAdministrator: boolean, canManageNotesUser: boolean, canUseTwoFactorUser: boolean,
        maxNoteNameCharsAdministrator: number | null = null, maxNoteNameCharsUser: number | null = null, maxNoteDescriptionCharsAdministrator: number | null = null, maxNoteDescriptionCharsUser: number | null = null, maxNoteTagsCharsAdministrator: number | null = null, maxNoteTagsCharsUser: number | null = null, maxNoteDataKbAdministrator: number | null = null, maxNoteDataKbUser: number | null = null,
        maxAttachmentFileSizeKbAdministrator: number | null = null, maxAttachmentFileSizeKbUser: number | null = null) {
        this.registrationEnabled = registrationEnabled;
        this.hasAnyUser = hasAnyUser;
        this.maxNotesAdministrator = maxNotesAdministrator;
        this.maxFoldersAdministrator = maxFoldersAdministrator;
        this.maxNotesUser = maxNotesUser;
        this.maxFoldersUser = maxFoldersUser;
        this.canManageNotesAdministrator = canManageNotesAdministrator;
        this.canUseTwoFactorAdministrator = canUseTwoFactorAdministrator;
        this.canManageNotesUser = canManageNotesUser;
        this.canUseTwoFactorUser = canUseTwoFactorUser;
        this.maxNoteNameCharsAdministrator = maxNoteNameCharsAdministrator;
        this.maxNoteNameCharsUser = maxNoteNameCharsUser;
        this.maxNoteDescriptionCharsAdministrator = maxNoteDescriptionCharsAdministrator;
        this.maxNoteDescriptionCharsUser = maxNoteDescriptionCharsUser;
        this.maxNoteTagsCharsAdministrator = maxNoteTagsCharsAdministrator;
        this.maxNoteTagsCharsUser = maxNoteTagsCharsUser;
        this.maxNoteDataKbAdministrator = maxNoteDataKbAdministrator;
        this.maxNoteDataKbUser = maxNoteDataKbUser;
        this.maxAttachmentFileSizeKbAdministrator = maxAttachmentFileSizeKbAdministrator;
        this.maxAttachmentFileSizeKbUser = maxAttachmentFileSizeKbUser;
    }
}
