import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { DTOGeneric, DTOUser } from "src/app/shared/dto";
import { HttpService } from "src/app/shared/services/http.service";
import { VMFolder, VMNote } from "src/app/shared/vm";

@Injectable({ providedIn: 'any' })

export class NoteCreateService {

  private httpService = inject(HttpService);

  public async CreateNote(model: VMNote.VMPost): Promise<{ message: string, success: boolean }> {
      const { response, success } = await this.httpService.PostForm<DTOGeneric.DTOResponseApi>('Note', model);
      return { message: response.message, success: success };
  }

  public async EditNote(model: VMNote.VMPut): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.PutForm<DTOGeneric.DTOResponseApi>('Note', model);
    return { message: response.message, success: success };
  }

  public async CreateFolder(model: VMFolder.VMPost): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.PostForm<DTOGeneric.DTOResponseApi>('Folder', model);
    return { message: response.message, success: success };
  }

  public async EditFolder(model: VMFolder.VMPut): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.PutForm<DTOGeneric.DTOResponseApi>('Folder', model);
    return { message: response.message, success: success };
  }

}
