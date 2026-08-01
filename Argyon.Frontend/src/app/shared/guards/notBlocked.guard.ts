import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

// A blocked account can only access /data (export its data); any other
// protected route redirects it there, same as the backend does with the other API routes.
export const NotBlockedGuard: CanActivateFn = () => {
    const router = inject(Router);
    const authService = inject(AuthService);

    if (authService.isBlocked() === false) {
        return true;
    }

    router.navigate(['/data']);
    return false;
};
