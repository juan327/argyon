import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { SettingsService } from "../services/settings.service";

export const languageInterceptor: HttpInterceptorFn = (req, next) => {
    const settingsService = inject(SettingsService);

    const clonedRequest = req.clone({
        setHeaders: { 'Accept-Language': settingsService.settings().language }
    });

    return next(clonedRequest);
};
