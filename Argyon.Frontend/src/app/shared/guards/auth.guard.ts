import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpService } from '../services/http.service';
import { AuthService } from '../services/auth.service';

export const AuthGuard: CanActivateFn = async (route, state) => {

    const router = inject(Router);
    const httpService = inject(HttpService);
    const authService = inject(AuthService);

    const isPingSuccessful = await httpService.Ping();
    if (isPingSuccessful) {
        // It is loaded here (and not in login) so that it is also available after
        // refreshing the page, before the nav and child routes render.
        if (authService.currentUser() === null) {
            await authService.LoadCurrentUser();
        }
        return true;
    }

    router.navigate(['/login']);
    return false;
};
