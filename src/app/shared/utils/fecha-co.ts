const DIA_COLOMBIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * "Today" for SILA: the calendar day in Colombia (`America/Bogota`, UTC-5, no daylight saving),
 * as `AAAA-MM-DD`. NOT the browser's day and NOT the UTC day: at 23:30 in Colombia it is already
 * tomorrow in UTC, but still today for the business. Use it as the initial value and `max` of date fields.
 * `ahora` only exists so tests can set the moment.
 */
export function hoyColombia(ahora: Date = new Date()): string {
  return DIA_COLOMBIA.format(ahora);
}
