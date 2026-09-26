import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpService } from '../services/http.service';
import { AuthService } from '../services/auth.service';
import { OfflineStorageService } from '../services/offlineStorage.service';
import { LocalStorageService } from '../services/localStorage.service';

export const AuthGuard: CanActivateFn = async (route, state) => {

    const router = inject(Router);
    const httpService = inject(HttpService);
    const authService = inject(AuthService);
    const offlineStorage = inject(OfflineStorageService);
    const localStorage = inject(LocalStorageService);

    await offlineStorage.WhenReady();
    const meta = offlineStorage.MetaFor(localStorage.GetItem<string>('user_username'));

    // Offline mode never touches the network: the local meta is enough to know who's "logged in"
    // (the unlock screen still gates access to the actual notes).
    if (offlineStorage.offlineMode()) {
        if (meta !== null) {
            if (authService.currentUser() === null) {
                authService.currentUser.set(meta.me);
            }
            return true;
        }
        offlineStorage.SetOfflineMode(false);
    }

    const status = await httpService.CheckConnection();
    if (status === 'online') {
        offlineStorage.serverUnreachable.set(false);
        // It is loaded here (and not in login) so that it is also available after
        // refreshing the page, before the nav and child routes render.
        if (authService.currentUser() === null) {
            await authService.LoadCurrentUser();
        }
        return true;
    }

    if (status === 'unauthorized') {
        router.navigate(['/login']);
        return false;
    }

    // Server unreachable: that's not an expired session, so don't send the user to /login.
    // MainComponent shows a retry screen that also offers entering offline mode.
    offlineStorage.serverUnreachable.set(true);
    if (meta !== null && authService.currentUser() === null) {
        authService.currentUser.set(meta.me);
    }
    return true;
};
