import { inject, Injectable } from "@angular/core";
import { DTOGeneric, DTOInfo } from "src/app/shared/dto";
import { HttpService } from "src/app/shared/services/http.service";

@Injectable({ providedIn: 'any' })

export class AboutService {

  private readonly httpService = inject(HttpService);

  public async GetVersion(): Promise<{ version: string }> {
    const { response, success } = await this.httpService.Get<DTOGeneric.DTOResponseApiData<DTOInfo.DTOVersion>>('Info');
    if (success === false) {
      return { version: '' };
    }
    return { version: response.data.version };
  }

}
