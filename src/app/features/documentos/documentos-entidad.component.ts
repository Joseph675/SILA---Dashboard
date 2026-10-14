import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { DocumentoDialogComponent } from './documento-dialog.component';
import { DocumentosListaComponent } from './documentos-lista.component';
import { Documento, TipoEntidadDocumento } from './models/documentos.models';

/** The documents of ONE entity (e.g. a milk reception) with the button to register a new one. */
@Component({
  selector: 'app-documentos-entidad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocumentoDialogComponent, DocumentosListaComponent, IconComponent],
  template: `
    <div class="mb-3 flex justify-end">
      <button type="button" class="sila-btn sila-btn-primary max-sm:w-full" (click)="dialogo.set(true)">
        <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
        Registrar documento
      </button>
    </div>
    <app-documentos-lista [tipoEntidad]="tipoEntidad()" [idEntidad]="idEntidad()" [filtrable]="false" [version]="version()" />
    <app-documento-dialog [abierto]="dialogo()" [tipoEntidad]="tipoEntidad()" [idEntidad]="idEntidad()" (registrado)="alRegistrar($event)" (cerrar)="dialogo.set(false)" />
  `,
})
export class DocumentosEntidadComponent {
  private readonly toast = inject(ToastService);

  readonly tipoEntidad = input.required<TipoEntidadDocumento>();
  readonly idEntidad = input.required<number>();

  protected readonly dialogo = signal(false);
  protected readonly version = signal(0);

  protected alRegistrar(documento: Documento): void {
    this.dialogo.set(false);
    this.version.update((v) => v + 1);
    this.toast.exito(`Documento «${documento.nombre_archivo}» registrado como pendiente.`);
  }
}
