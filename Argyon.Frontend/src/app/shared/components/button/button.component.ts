import { Component, inject, input, InputSignal, output, signal } from '@angular/core';
import { FieldTree, form, FormField, min, minLength, required, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { ButtonModule, ButtonSeverity } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'component-button',
    templateUrl: './button.component.html',
    imports: [ButtonModule, TooltipModule]
})

export class ButtonComponent {
    label = input<string>();
    type = input<string>("button");
    disabled = input<boolean>(false);
    severity = input<ButtonSeverity>("primary");
    size = input<"small" | "large" | undefined>("large");
    rounded = input<boolean>(false);
    icon = input<string>();
    width = input<string>("100%");
    tooltip = input<string>();
    tooltipPosition = input<"top" | "bottom" | "left" | "right">("top");

    onClick = output<void>();

    async ngOnInit() {
    }

}
