import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { DTOGeneric, DTOUser } from "src/app/shared/dto";
import { HttpService } from "src/app/shared/services/http.service";
import { VMNote } from "src/app/shared/vm";

@Injectable({ providedIn: 'any' })

export class NoteListService {

  private httpService = inject(HttpService);


}
