import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AlertService } from 'src/app/shared/services/alert.service';

@Component({
    selector: 'component-loading',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, DialogModule, ProgressSpinnerModule],
    templateUrl: './loading.component.html'
})

export class LoadingComponent {

    private readonly _alertService = inject(AlertService);
    public _visible = computed(() => this._alertService.visibleLoading());
    public _message = computed(() => this._alertService.messageLoading());
}
