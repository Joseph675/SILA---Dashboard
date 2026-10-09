import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** `desde` / `hasta` as UTC days (`AAAA-MM-DD`). The help text says so, because the table shows Colombia time. */
@Component({
  selector: 'app-filtro-fechas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <label [attr.for]="idBase() + '-desde'" class="mb-1 block text-xs font-medium text-muted-foreground">Desde</label>
      <input [id]="idBase() + '-desde'" type="date" class="sila-input w-40" [max]="hasta() || null" [value]="desde()" (change)="desdeChange.emit($any($event.target).value)" />
    </div>
    <div>
      <label [attr.for]="idBase() + '-hasta'" class="mb-1 block text-xs font-medium text-muted-foreground">Hasta</label>
      <input [id]="idBase() + '-hasta'" type="date" class="sila-input w-40" [min]="desde() || null" [value]="hasta()" (change)="hastaChange.emit($any($event.target).value)" />
    </div>
  `,
  host: { class: 'contents' },
})
export class FiltroFechasComponent {
  readonly idBase = input.required<string>();
  readonly desde = input('');
  readonly hasta = input('');

  readonly desdeChange = output<string>();
  readonly hastaChange = output<string>();
}
