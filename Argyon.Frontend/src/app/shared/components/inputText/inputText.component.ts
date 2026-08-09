import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { IftaLabelModule } from 'primeng/iftalabel';

@Component({
    selector: 'component-input-text',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormField, InputTextModule, InputGroupModule, InputGroupAddonModule, ButtonModule, IftaLabelModule, NgTemplateOutlet],
    templateUrl: './inputText.component.html'
})

export class InputTextComponent {

    formField = model<FieldTree<string, string>>();
    placeholder = model<string>('');
    label = input<string>('');
    value = model<string>('');
    readonly = model<boolean>(false);
    disabled = model<boolean>(false);
    showCopyButton = input<boolean>(false);

    onCopy = output<void>();

    // Reflects the dynamic maxLength() validator configured on the bound signal-forms field
    // (if any), so a "current/max" hint can be shown without the caller having to pass it separately.
    public readonly maxChars = computed(() => this.formField()?.().maxLength?.() ?? null);
    public readonly currentChars = computed(() => this.formField()?.().value().length ?? 0);
}
