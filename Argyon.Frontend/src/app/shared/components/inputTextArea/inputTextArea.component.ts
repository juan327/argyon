import { JsonPipe } from '@angular/common';
import { Component, computed, inject, input, model, OnInit } from '@angular/core';
import { FieldTree, form, FormField, min, minLength, required, validate } from '@angular/forms/signals';
import { TextareaModule } from 'primeng/textarea';
import { IftaLabelModule } from 'primeng/iftalabel';

@Component({
    selector: 'component-inputTextArea',
    imports: [FormField, TextareaModule, IftaLabelModule],
    templateUrl: './inputTextArea.component.html'
})

export class InputTextAreaComponent implements OnInit {

    formField = model<FieldTree<string, string>>();
    placeholder = model<string>('');
    label = input<string>('');
    value = model<string>('');
    readonly = model<boolean>(false);
    disabled = model<boolean>(false);
    rows = model<number>(3);

    // Reflects the dynamic maxLength() validator configured on the bound signal-forms field
    // (if any), so a "current/max" hint can be shown without the caller having to pass it separately.
    public readonly maxChars = computed(() => this.formField()?.().maxLength?.() ?? null);
    public readonly currentChars = computed(() => this.formField()?.().value().length ?? 0);

    async ngOnInit() {
    }
}
