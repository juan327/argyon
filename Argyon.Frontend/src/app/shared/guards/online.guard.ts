import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { OfflineStorageService } from '../services/offlineStorage.service';

// Blocks direct URL access to server-dependent pages (users, system, about) while offline mode
// is on; the nav also shows them disabled (see nav.component.ts). Not applied to /data: exporting
// notes works entirely offline (it only needs the already-decrypted notes and the cached vault
// key wrap info), only importing needs the server, and that's gated inside the page itself.
export const OnlineGuard: CanActivateFn = () => {
    const router = inject(Router);
    const offlineStorage = inject(OfflineStorageService);

    if (offlineStorage.offlineMode() === false) {
        return true;
    }

    router.navigate(['/home']);
    return false;
};
