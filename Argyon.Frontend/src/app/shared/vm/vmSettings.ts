export class VMSetRegistrationEnabled
{
    enabled: boolean = false;
}

export class VMSetLimits
{
    maxNotesAdministrator: number | null = null;
    maxFoldersAdministrator: number | null = null;
    maxNotesUser: number | null = null;
    maxFoldersUser: number | null = null;
}

export class VMSetPermissions
{
    canManageNotesAdministrator: boolean = true;
    canUseTwoFactorAdministrator: boolean = true;
    canManageNotesUser: boolean = true;
    canUseTwoFactorUser: boolean = true;
}

export class VMSetContentLimits
{
    maxNoteNameCharsAdministrator: number | null = null;
    maxNoteNameCharsUser: number | null = null;
    maxNoteDescriptionCharsAdministrator: number | null = null;
    maxNoteDescriptionCharsUser: number | null = null;
    maxNoteTagsCharsAdministrator: number | null = null;
    maxNoteTagsCharsUser: number | null = null;
    maxNoteDataKbAdministrator: number | null = null;
    maxNoteDataKbUser: number | null = null;
    maxAttachmentFileSizeKbAdministrator: number | null = null;
    maxAttachmentFileSizeKbUser: number | null = null;
}
