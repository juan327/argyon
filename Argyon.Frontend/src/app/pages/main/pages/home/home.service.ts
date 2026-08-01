import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { DTOGeneric, DTOUser } from "src/app/shared/dto";
import { HttpService } from "src/app/shared/services/http.service";
import { VMFolder, VMNote } from "src/app/shared/vm";

@Injectable({ providedIn: 'any' })

export class HomeService {

  private httpService = inject(HttpService);

  public async DeleteNote(model: VMNote.VMDelete): Promise<{ message: string, success: boolean }> {
      const { response, success } = await this.httpService.Delete<DTOGeneric.DTOResponseApi>('Note', model);
      return { message: response.message, success: success };

  }

  public async SetFavorite(model: VMNote.VMSetFavorite): Promise<{ message: string, success: boolean }> {
      const { response, success } = await this.httpService.Put<DTOGeneric.DTOResponseApi>('Note/SetFavorite', model);
      return { message: response.message, success: success };
  }


}
