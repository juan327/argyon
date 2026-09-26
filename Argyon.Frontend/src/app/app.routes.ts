import { Routes } from '@angular/router';
import { AuthGuard } from './shared/guards/auth.guard';
import { RoleGuard } from './shared/guards/role.guard';
import { OwnerGuard } from './shared/guards/owner.guard';
import { NotBlockedGuard } from './shared/guards/notBlocked.guard';
import { OnlineGuard } from './shared/guards/online.guard';

export const routes: Routes = [
    {
        canActivate: [AuthGuard],
        path: '',
        loadComponent() {
            return import('./pages/main/main.component').then(m => m.MainComponent);
        },
        children: [
            {
                path: '',
                redirectTo: 'home',
                pathMatch: 'full'
            },
            {
                path: 'home',
                canActivate: [NotBlockedGuard],
                data: { titleKey: 'nav.home' },
                loadComponent() {
                    return import('./pages/main/pages/home/home.component').then(m => m.HomeComponent);
                },
            },
            {
                path: 'settings',
                canActivate: [NotBlockedGuard],
                data: { titleKey: 'settings.title' },
                loadComponent() {
                    return import('./pages/main/pages/settings/settings.component').then(m => m.SettingsComponent);
                },
            },
            {
                path: 'about',
                canActivate: [NotBlockedGuard, OnlineGuard],
                data: { titleKey: 'about.title' },
                loadComponent() {
                    return import('./pages/main/pages/about/about.component').then(m => m.AboutComponent);
                },
            },
            {
                path: 'data',
                data: { titleKey: 'data.title' },
                loadComponent() {
                    return import('./pages/main/pages/data/data.component').then(m => m.DataComponent);
                },
            },
            {
                path: 'users',
                canActivate: [RoleGuard, NotBlockedGuard, OnlineGuard],
                data: { titleKey: 'users.title' },
                loadComponent() {
                    return import('./pages/main/pages/users/users.component').then(m => m.UsersComponent);
                },
            },
            {
                path: 'system',
                canActivate: [OwnerGuard, NotBlockedGuard, OnlineGuard],
                data: { titleKey: 'system.title' },
                loadComponent() {
                    return import('./pages/main/pages/system/system.component').then(m => m.SystemComponent);
                },
            }
        ]
    },
    {
        path: 'login',
        data: { mode: 'login', titleKey: 'login.title' },
        loadComponent() {
            return import('./pages/login/login.component').then(m => m.LoginComponent);
        },
    },
    {
        path: 'register',
        data: { mode: 'register', titleKey: 'register.title' },
        loadComponent() {
            return import('./pages/login/login.component').then(m => m.LoginComponent);
        },
    },
    {
        path: '**',
        redirectTo: 'login'
    }
];
