import { inject, Injectable } from '@angular/core';
import { DTOGeneric, DTOSettings } from 'src/app/shared/dto';
import { HttpService } from 'src/app/shared/services/http.service';
import { VMSettings } from 'src/app/shared/vm';

@Injectable({ providedIn: 'root' })

export class SystemSettingsService {
  private readonly httpService = inject(HttpService);

  public async Get(): Promise<{
    message: string, success: boolean, registrationEnabled: boolean, hasAnyUser: boolean,
    maxNotesAdministrator: number | null, maxFoldersAdministrator: number | null,
    maxNotesUser: number | null, maxFoldersUser: number | null,
    canManageNotesAdministrator: boolean, canUseTwoFactorAdministrator: boolean,
    canManageNotesUser: boolean, canUseTwoFactorUser: boolean,
    maxNoteNameCharsAdministrator: number | null, maxNoteNameCharsUser: number | null,
    maxNoteDescriptionCharsAdministrator: number | null, maxNoteDescriptionCharsUser: number | null,
    maxNoteTagsCharsAdministrator: number | null, maxNoteTagsCharsUser: number | null,
    maxNoteDataKbAdministrator: number | null, maxNoteDataKbUser: number | null,
    maxAttachmentFileSizeKbAdministrator: number | null, maxAttachmentFileSizeKbUser: number | null,
  }> {
    const { response, success } = await this.httpService.Get<DTOGeneric.DTOResponseApiData<DTOSettings.DTOSystemSettings>>('Settings');
    return {
      message: response.message, success, registrationEnabled: response.data?.registrationEnabled ?? true,
      hasAnyUser: response.data?.hasAnyUser ?? true,
      maxNotesAdministrator: response.data?.maxNotesAdministrator ?? null,
      maxFoldersAdministrator: response.data?.maxFoldersAdministrator ?? null,
      maxNotesUser: response.data?.maxNotesUser ?? null,
      maxFoldersUser: response.data?.maxFoldersUser ?? null,
      canManageNotesAdministrator: response.data?.canManageNotesAdministrator ?? true,
      canUseTwoFactorAdministrator: response.data?.canUseTwoFactorAdministrator ?? true,
      canManageNotesUser: response.data?.canManageNotesUser ?? true,
      canUseTwoFactorUser: response.data?.canUseTwoFactorUser ?? true,
      maxNoteNameCharsAdministrator: response.data?.maxNoteNameCharsAdministrator ?? null,
      maxNoteNameCharsUser: response.data?.maxNoteNameCharsUser ?? null,
      maxNoteDescriptionCharsAdministrator: response.data?.maxNoteDescriptionCharsAdministrator ?? null,
      maxNoteDescriptionCharsUser: response.data?.maxNoteDescriptionCharsUser ?? null,
      maxNoteTagsCharsAdministrator: response.data?.maxNoteTagsCharsAdministrator ?? null,
      maxNoteTagsCharsUser: response.data?.maxNoteTagsCharsUser ?? null,
      maxNoteDataKbAdministrator: response.data?.maxNoteDataKbAdministrator ?? null,
      maxNoteDataKbUser: response.data?.maxNoteDataKbUser ?? null,
      maxAttachmentFileSizeKbAdministrator: response.data?.maxAttachmentFileSizeKbAdministrator ?? null,
      maxAttachmentFileSizeKbUser: response.data?.maxAttachmentFileSizeKbUser ?? null,
    };
  }

  public async SetRegistrationEnabled(model: VMSettings.VMSetRegistrationEnabled): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.Put<DTOGeneric.DTOResponseApi>('Settings/Registration', model);
    return { message: response.message, success };
  }

  public async SetLimits(model: VMSettings.VMSetLimits): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.Put<DTOGeneric.DTOResponseApi>('Settings/Limits', model);
    return { message: response.message, success };
  }

  public async SetPermissions(model: VMSettings.VMSetPermissions): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.Put<DTOGeneric.DTOResponseApi>('Settings/Permissions', model);
    return { message: response.message, success };
  }

  public async SetContentLimits(model: VMSettings.VMSetContentLimits): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.Put<DTOGeneric.DTOResponseApi>('Settings/ContentLimits', model);
    return { message: response.message, success };
  }
}
