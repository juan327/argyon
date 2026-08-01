import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const RoleGuard: CanActivateFn = () => {
    const router = inject(Router);
    const authService = inject(AuthService);

    if (authService.canViewUsersModule()) {
        return true;
    }

    router.navigate(['/home']);
    return false;
};
