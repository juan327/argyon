import { inject, Injectable, signal } from "@angular/core";
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })

export class AlertService {
    private readonly _messageService = inject(MessageService);
    private readonly _confirmationService = inject(ConfirmationService);
    private readonly _translate = inject(TranslateService);

    public visibleLoading = signal(false);
    public messageLoading = signal('');

    public showAlert(severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail: string): void {
        this._messageService.add({ severity, summary, detail });
    }

    
    public showSuccess(summary: string, detail: string | undefined = undefined): void {
        this._messageService.add({ severity: 'success', summary, detail });
    }

    public showError(summary: string, detail: string | undefined = undefined): void {
        this._messageService.add({ severity: 'error', summary, detail });
    }
    
    public showInfo(summary: string, detail: string | undefined = undefined): void {
        this._messageService.add({ severity: 'info', summary, detail });
    }

    public showWarn(summary: string, detail: string | undefined = undefined): void {
        this._messageService.add({ severity: 'warn', summary, detail });
    }
    
    public showLoading(message: string): void {
        this.visibleLoading.set(true);
        this.messageLoading.set(message);
    }

    public hideLoading(): void {
        this.visibleLoading.set(false);
        this.messageLoading.set('');
    }

    public showConfirmation(model: { title: string, message: string, icon: string, acceptLabel: string, acceptSeverity: 'success' | 'info' | 'warn' | 'danger', accept: () => void, reject?: () => void }): void {
        const { title, message, icon, acceptLabel, acceptSeverity, accept, reject } = model;
        this._confirmationService.confirm({
            header: title,
            message: message,
            icon: icon,
            rejectLabel: this._translate.instant('common.cancel'),
            rejectButtonProps: {
                label: this._translate.instant('common.cancel'),
                severity: 'secondary',
                outlined: true
            },
            acceptButtonProps: {
                label: acceptLabel,
                severity: acceptSeverity
            },
        
            accept: () => {
                accept();
            },
            reject: () => {
                if (reject) {
                    reject();
                }
            }
        });
    }

}
