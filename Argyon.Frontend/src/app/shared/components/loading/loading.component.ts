import { CommonModule, JsonPipe } from '@angular/common';
import { Component, computed, ContentChild, inject, input, InputSignal, model, OnInit, output, signal, TemplateRef } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AlertService } from 'src/app/shared/services/alert.service';

@Component({
    selector: 'component-loading',
    imports: [CommonModule, DialogModule, ProgressSpinnerModule],
    templateUrl: './loading.component.html'
})

export class LoadingComponent implements OnInit {

    private readonly _alertService = inject(AlertService);
    public _visible = computed(() => this._alertService.visibleLoading());
    public _message = computed(() => this._alertService.messageLoading());

    async ngOnInit() {
    }

}
