import { Component, effect, inject, input, InputSignal, model, OnInit, output, signal } from '@angular/core';
import { FieldTree, form, FormField, min, minLength, required, validate } from '@angular/forms/signals';
import { InputTextModule } from 'primeng/inputtext';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'component-inputAutocomplete',
    imports: [AutoCompleteModule, FormsModule],
    templateUrl: './inputAutocomplete.component.html'
})

export class InputAutocompleteComponent implements OnInit {

    placeholder = model<string>('');
    readonly = model<boolean>(false);
    disabled = model<boolean>(false);
    initialValue = input<string>('');

    onValueChange = output<string>();


    public _model = signal<string[]>([]);

    constructor() {
        effect(() => {
            this.onValueChange.emit(this._model().join(','));
        });
    }
    

    async ngOnInit() {
        this._model.set(this.initialValue().split(',').map(item => item.trim()).filter(item => item.length > 0));
    }
}
