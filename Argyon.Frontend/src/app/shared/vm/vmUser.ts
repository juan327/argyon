import { DTOUser } from '../dto';

export class VMRegister
{
    username: string = '';
    authHash: string = '';
    salt: string = '';
    kdfAlgorithm: string = '';
    kdfMemory: number = 0;
    kdfIterations: number = 0;
    kdfParallelism: number = 0;
    encryptedVaultKeyIv: string = '';
    encryptedVaultKey: string = '';
}

export class VMLogin
{
    username: string = '';
    authHash: string = '';
}

export class VMValidatePassword
{
    authHash: string = '';
}

export class VMChangePassword
{
    currentAuthHash: string = '';
    newAuthHash: string = '';
    salt: string = '';
    kdfAlgorithm: string = '';
    kdfMemory: number = 0;
    kdfIterations: number = 0;
    kdfParallelism: number = 0;
    encryptedVaultKeyIv: string = '';
    encryptedVaultKey: string = '';
}

export class VMPrelogin
{
    username: string = '';
}

export class VMList
{
    skip: number = 0;
    take: number = 10;
    search: string = '';
}

export class VMChangeRole
{
    userId: string = '';
    roleCode: DTOUser.RoleCode = DTOUser.RoleCode.User;
}

export class VMDeleteUser
{
    userId: string = '';
}

export class VMCreateUser
{
    username: string = '';
    authHash: string = '';
    roleCode: DTOUser.RoleCode = DTOUser.RoleCode.User;
    salt: string = '';
    kdfAlgorithm: string = '';
    kdfMemory: number = 0;
    kdfIterations: number = 0;
    kdfParallelism: number = 0;
    encryptedVaultKeyIv: string = '';
    encryptedVaultKey: string = '';
}

export class VMSetBlocked
{
    userId: string = '';
    isBlocked: boolean = false;
}

export class VMSetLimits
{
    userId: string = '';
    maxNotesOverride: number | null = null;
    maxFoldersOverride: number | null = null;
}

export class VMSetPermissions
{
    userId: string = '';
    canManageNotesOverride: boolean | null = null;
    canUseTwoFactorOverride: boolean | null = null;
}

export class VMSetContentLimits
{
    userId: string = '';
    maxNoteNameCharsOverride: number | null = null;
    maxNoteDescriptionCharsOverride: number | null = null;
    maxNoteTagsCharsOverride: number | null = null;
    maxNoteDataKbOverride: number | null = null;
    maxAttachmentFileSizeKbOverride: number | null = null;
}