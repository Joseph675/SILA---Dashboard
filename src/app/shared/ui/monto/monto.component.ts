import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatoCop } from '../../utils/formato-co';

/** A COP amount. A negative one is red AND shows its minus sign (never color alone). */
@Component({
  selector: 'app-monto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="tabular-nums" [class.text-destructive]="valor() < 0" [class.font-semibold]="valor() < 0 || destacado()">{{ texto() }}</span>`,
})
export class MontoComponent {
  readonly valor = input.required<number>();
  readonly destacado = input(false);
  protected texto(): string {
    return formatoCop(this.valor());
  }
}
