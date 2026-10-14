/** One table column: how it is labelled, sorted and aligned. */
export interface DataTableColumn<T> {
  /** Also the field sent as `sort=<key>,asc|desc`, so it must match the API's column name. */
  key: string;
  label: string;
  /** Cell/heading alignment. Defaults to `start`. */
  align?: 'start' | 'end';
  /** Defaults to `true`; decorative or action columns set it to `false`. */
  sortable?: boolean;
  /**
   * On a phone each row is a card. `ocultarEnMovil` leaves this (secondary) column out of the card.
   * Default: shown.
   */
  ocultarEnMovil?: boolean;
  /**
   * Role of the column in the phone card: `titulo` = the card's heading (default: the first column),
   * `acciones` = the buttons at the foot of the card (default: the column keyed `acciones`).
   */
  rol?: 'titulo' | 'acciones';
  /** Fallback cell text when the column has no custom `appDataTableCell` template. */
  value: (row: T) => string | number;
}

export interface DataTableCellContext<T> {
  $implicit: T;
  index: number;
}
