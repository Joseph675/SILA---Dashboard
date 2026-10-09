import { Directive, TemplateRef, inject, input } from '@angular/core';
import type { DataTableCellContext } from './data-table.models';

/**
 * Custom rendering for one `app-data-table` column, matched by column key:
 * `<ng-template appDataTableCell="name" [cellRows]="customers()" let-row>`.
 *
 * Columns without a matching template fall back to their `value(row)` text.
 * `cellRows` carries no runtime meaning — binding the same array the table
 * receives is what types `let-row` inside the template.
 */
@Directive({
  selector: 'ng-template[appDataTableCell]',
  standalone: true,
})
export class DataTableCellDirective<T> {
  readonly template = inject<TemplateRef<DataTableCellContext<T>>>(TemplateRef);

  /** Key of the column this template renders. */
  readonly appDataTableCell = input.required<string>();
  /** Type anchor for `let-row`; bind the table's own rows. */
  readonly cellRows = input<readonly T[]>();

  static ngTemplateContextGuard<T>(
    _directive: DataTableCellDirective<T>,
    _context: unknown,
  ): _context is DataTableCellContext<T> {
    return true;
  }
}
