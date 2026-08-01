import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'component-infoTooltip',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TooltipModule],
    templateUrl: './infoTooltip.component.html'
})

export class InfoTooltipComponent {
    text = input.required<string>();
    tooltipPosition = input<"top" | "bottom" | "left" | "right">("top");
}
