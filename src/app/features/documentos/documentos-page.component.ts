import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { DocumentosListaComponent } from './documentos-lista.component';

/** Documentos Drive: the queue of documents waiting for (or already with) their upload. */
@Component({
  selector: 'app-documentos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocumentosListaComponent, PageHeaderComponent],
  template: `
    <app-page-header title="Documentos Drive" description="Los documentos registrados y el estado de su subida a Google Drive. Se registran desde el detalle de cada recepción." />
    <app-documentos-lista />
  `,
})
export class DocumentosPageComponent {}
