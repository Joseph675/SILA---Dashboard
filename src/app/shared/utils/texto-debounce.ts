import { Signal, WritableSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

/** A text box value and the same value after 300 ms without typing (trimmed). Call it where `inject()` works. */
export function textoConEspera(inicial = ''): { crudo: WritableSignal<string>; valor: Signal<string> } {
  const crudo = signal(inicial);
  const valor = toSignal(
    toObservable(crudo).pipe(
      debounceTime(300),
      map((texto) => texto.trim()),
      distinctUntilChanged(),
    ),
    { initialValue: inicial.trim() },
  );
  return { crudo, valor };
}
