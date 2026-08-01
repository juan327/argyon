import { CommonModule, JsonPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ContentChild, effect, inject, input, OnDestroy, OnInit, output, TemplateRef, ViewChild } from '@angular/core';
import { Dialog, DialogModule } from 'primeng/dialog';
import { HttpService } from '../../services/http.service';
import { ModalScrollLockService } from '../../services/modalScrollLock.service';

// Below this width the modal opens in full screen by default.
const MOBILE_BREAKPOINT = '(width <= 800px)';

@Component({
    selector: 'component-dialog',
    imports: [CommonModule, DialogModule],
    templateUrl: './dialog.component.html'
})

export class DialogComponent implements OnInit, AfterViewInit, OnDestroy {
    @ContentChild('header') headerTemplate!: TemplateRef<any>;
    @ContentChild('footer') footerTemplate!: TemplateRef<any>;
    @ViewChild(Dialog) dialog!: Dialog;

    private readonly httpService = inject(HttpService);
    private readonly modalScrollLockService = inject(ModalScrollLockService);
    private readonly cdRef = inject(ChangeDetectorRef);
    // Counter value when the modal is created: we only care about 401s
    // that occur while the modal is open, not ones that already happened before.
    private readonly sessionExpiredBaseline = this.httpService.sessionExpired();

    // If false, the modal cannot toggle between full screen and normal,
    // so it is also not forced to full screen on mobile.
    public maximizable = input(true);

    // For confirmation modals or ones with little content: forces maximizable
    // off and caps the modal to a narrower max width instead of the default 90vw.
    public small = input(false);

    public open = output<boolean>();

    constructor() {
        // If the session expires (401), the modal closes along with the rest of the app.
        effect(() => {
            if (this.httpService.sessionExpired() > this.sessionExpiredBaseline) {
                this.open.emit(false);
            }
        });
    }

    async ngOnInit() {
        this.modalScrollLockService.Register();
    }

    ngAfterViewInit() {
        if (this.isMaximizable() && window.matchMedia(MOBILE_BREAKPOINT).matches) {
            // maximize() mutates an internal field of the PrimeNG component (not a signal),
            // so its view check has to be forced so it reflects as already open in full screen.
            this.dialog.maximize();
            this.cdRef.detectChanges();
        }
    }

    ngOnDestroy() {
        this.modalScrollLockService.Unregister();
    }

    public isMaximizable(): boolean {
        return this.maximizable() && !this.small();
    }

    public onVisibleChange(event: boolean) {
        this.open.emit(event);
    }
}
