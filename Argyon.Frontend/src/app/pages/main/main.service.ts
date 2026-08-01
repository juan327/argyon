import { inject, Injectable } from "@angular/core";
import { AuthService } from "src/app/shared/services/auth.service";

@Injectable({ providedIn: 'any' })

export class MainService {

    private authService = inject(AuthService);

}
