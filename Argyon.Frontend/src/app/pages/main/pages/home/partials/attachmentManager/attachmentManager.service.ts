import { inject, Injectable } from "@angular/core";
import { DTOGeneric, DTOAttachment } from "src/app/shared/dto";
import { HttpService } from "src/app/shared/services/http.service";
import { VMAttachment } from "src/app/shared/vm";

@Injectable({ providedIn: 'any' })

export class AttachmentManagerService {

  private httpService = inject(HttpService);

  public async ListAttachments(noteId: string): Promise<{ message: string, success: boolean, data: DTOAttachment.DTOGet[] }> {
    const { response, success } = await this.httpService.Get<DTOGeneric.DTOResponseApiListData<DTOAttachment.DTOGet>>('Attachment', { noteId });
    return { message: response.message, success, data: response.data ?? [] };
  }

  public async UploadAttachment(model: VMAttachment.VMCreate): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.PostForm<DTOGeneric.DTOResponseApi>('Attachment', model);
    return { message: response.message, success };
  }

  public async DeleteAttachment(model: VMAttachment.VMDelete): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.Delete<DTOGeneric.DTOResponseApi>('Attachment', model);
    return { message: response.message, success };
  }

  public async DownloadAttachment(noteId: string, attachmentId: string): Promise<{ response: Blob | null, success: boolean }> {
    return this.httpService.GetBlob('Attachment/Download', { noteId, attachmentId });
  }

}
