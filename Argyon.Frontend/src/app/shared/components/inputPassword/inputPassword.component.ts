import { Component, computed, input, model, output, signal } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { KeyFilterModule } from 'primeng/keyfilter';
import { IftaLabelModule } from 'primeng/iftalabel';
import { GeneratePasswordComponent } from 'src/app/shared/components/generatePassword/generatePassword.component';

@Component({
    selector: 'component-inputPassword',
    imports: [InputTextModule, InputGroupModule, InputGroupAddonModule, ButtonModule, KeyFilterModule, IftaLabelModule, GeneratePasswordComponent],
    templateUrl: './inputPassword.component.html'
})

export class InputPasswordComponent {

    public disableSpace = input<boolean>(false);
    public placeholder = input<string>('');
    public label = input<string>('');
    public showCopyButton = input<boolean>(false);
    public showGenerateButton = input<boolean>(false);
    public disabled = input<boolean>(false);

    public onCopy = output<void>();

    public value = model<string>('');

    public _modalOpen = signal<boolean>(false);
    public _type = signal<string>('password');
    public _icon = computed(() => this._type() === 'password' ? 'pi pi-eye' : 'pi pi-eye-slash');

    
    public _blockSpace: RegExp = /^[^\s]+$/;

    async ngOnInit() {
    }

    public togglePasswordVisibility() {
        this._type.set(this._type() === 'password' ? 'text' : 'password');
    }

    public openAdvancedSettings() {
        this._modalOpen.set(true);
    }

    public applyPassword(password: string) {
        this.value.set(password);
        this._modalOpen.set(false);
    }
}
