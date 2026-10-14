import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import type { Page } from '../../../core/api/page.models';
import { EsMovilService } from '../../services/es-movil.service';
import type { DataTableColumn } from '../data-table/data-table.models';
import { ServerDataTableComponent } from './server-data-table.component';

interface Fila {
  id: number;
  nombre: string;
  ciudad: string;
  total: number;
}

const COLUMNAS: DataTableColumn<Fila>[] = [
  { key: 'id', label: 'Código', value: (f) => f.id },
  { key: 'nombre', label: 'Nombre', rol: 'titulo', value: (f) => f.nombre },
  { key: 'ciudad', label: 'Ciudad', ocultarEnMovil: true, value: (f) => f.ciudad },
  { key: 'total', label: 'Total', value: (f) => f.total },
  { key: 'acciones', label: 'Acciones', sortable: false, value: () => '' },
];
const PAGINA: Page<Fila> = { items: [{ id: 1, nombre: 'Ana', ciudad: 'Bogotá', total: 10 }, { id: 2, nombre: 'Luis', ciudad: 'Cali', total: 20 }], total: 2, page: 0, size: 10 };

describe('ServerDataTableComponent · responsive', () => {
  const movil = signal(true);

  function crear(): ComponentFixture<ServerDataTableComponent<Fila>> {
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: EsMovilService, useValue: { movil } }] });
    const f = TestBed.createComponent<ServerDataTableComponent<Fila>>(ServerDataTableComponent);
    f.componentRef.setInput('columns', COLUMNAS);
    f.componentRef.setInput('page', PAGINA);
    f.componentRef.setInput('rowId', (r: Fila) => r.id);
    f.componentRef.setInput('titulo', 'Personas');
    f.componentRef.setInput('sort', 'nombre,asc');
    f.detectChanges();
    return f;
  }
  const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;

  it('en teléfono cada fila es una tarjeta (sin <table>), con la columna «titulo» como encabezado', () => {
    movil.set(true);
    const f = crear();

    expect(raiz(f).querySelector('table')).toBeNull();
    const tarjetas = raiz(f).querySelectorAll('[data-tarjeta]');
    expect(tarjetas.length).toBe(2);
    expect(tarjetas[0].querySelector('.font-medium')?.textContent?.trim()).toBe('Ana');
  });

  it('respeta ocultarEnMovil: la columna secundaria no aparece en la tarjeta, pero las demás sí', () => {
    movil.set(true);
    const f = crear();
    const texto = Array.from(raiz(f).querySelectorAll('[data-tarjeta]')).map((t) => t.textContent).join(' ');

    expect(texto).not.toContain('Bogotá');
    expect(texto).not.toContain('Ciudad');
    expect(texto).toContain('Código');
    expect(texto).toContain('Total');
  });

  it('en teléfono se puede ordenar con un selector «Ordenar por» (las columnas sin orden no salen) y un botón de dirección', () => {
    movil.set(true);
    const f = crear();
    const orden: string[] = [];
    f.componentInstance.sortChange.subscribe((v) => orden.push(v));

    const opciones = Array.from(raiz(f).querySelectorAll('select option')).map((o) => o.textContent?.trim());
    expect(opciones).toContain('Nombre');
    expect(opciones).not.toContain('Acciones');

    raiz(f).querySelector<HTMLButtonElement>('button[aria-label^="Orden"]')!.click();
    expect(orden).toEqual(['nombre,desc']);
  });

  it('en pantalla grande sigue siendo una tabla y la columna oculta en móvil SÍ se muestra', () => {
    movil.set(false);
    const f = crear();

    expect(raiz(f).querySelector('table')).not.toBeNull();
    expect(raiz(f).querySelector('[data-tarjeta]')).toBeNull();
    expect(raiz(f).textContent).toContain('Bogotá');
  });
});
