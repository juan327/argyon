import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputMaskModule } from 'primeng/inputmask';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { IftaLabelModule } from 'primeng/iftalabel';

@Component({
    selector: 'component-input-mask',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [InputTextModule, InputMaskModule, FormsModule, InputGroupModule, InputGroupAddonModule, ButtonModule, IftaLabelModule],
    templateUrl: './inputMask.component.html'
})

export class InputMaskComponent {

    public mask = input.required<string>();
    public placeholder = input<string>('');
    public label = input<string>('');
    public disabled = input<boolean>(false);
    public showCopyButton = input<boolean>(false);

    public onCopy = output<void>();

    public value = model<string>('');
}
