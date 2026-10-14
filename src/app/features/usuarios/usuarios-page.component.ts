import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import type { Observable } from 'rxjs';
import { ApiErrorService } from '../../core/api/api-error';
import type { Rol } from '../../core/auth/auth.models';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoFechaHora } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { ClaveTemporal, ClaveTemporalDialogComponent } from './clave-temporal-dialog.component';
import { USUARIOS_REPOSITORY } from './data/usuarios.provider';
import type { Usuario, UsuarioConClaveTemporal } from './models/usuarios.models';
import { UsuarioFormDialogComponent, UsuarioGuardado } from './usuario-form-dialog.component';
import { UsuarioSesionesDialogComponent } from './usuario-sesiones-dialog.component';

type FiltroActivo = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';
type FiltroRol = 'TODOS' | Rol;
type TipoAccion = 'estado' | 'desbloquear' | 'clave' | 'mfa' | 'sesiones';

interface Accion {
  tipo: TipoAccion;
  usuario: Usuario;
}

const MOTIVO_PROPIA_CUENTA = 'No puedes hacer esto sobre tu propia cuenta: lo hace otro administrador.';

@Component({
  selector: 'app-usuarios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FiltrosPlegablesComponent, 
    ClaveTemporalDialogComponent,
    ConfirmDialogComponent,
    DataTableCellDirective,
    HasRoleDirective,
    IconComponent,
    PageHeaderComponent,
    ServerDataTableComponent,
    StatusChipComponent,
    UsuarioFormDialogComponent,
    UsuarioSesionesDialogComponent,
  ],
  templateUrl: './usuarios-page.component.html',
})
export class UsuariosPageComponent {
  private readonly repo = inject(USUARIOS_REPOSITORY);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- List ----------

  protected readonly texto = signal('');
  protected readonly filtroRol = signal<FiltroRol>('TODOS');
  protected readonly filtroActivo = signal<FiltroActivo>('TODOS');
  private readonly textoBusqueda = toSignal(
    toObservable(this.texto).pipe(
      debounceTime(300),
      map((texto) => texto.trim()),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  protected readonly listado = crearListado({
    filtros: () => ({
      texto: this.textoBusqueda() || undefined,
      rol: this.filtroRol() === 'TODOS' ? undefined : (this.filtroRol() as Rol),
      activo: this.filtroActivo() === 'TODOS' ? undefined : this.filtroActivo() === 'ACTIVOS',
    }),
    cargar: (query) => this.repo.listar(query),
    sort: 'nombre,asc',
  });

  protected readonly columnas: DataTableColumn<Usuario>[] = [
    { key: 'usuario', label: 'Usuario', value: (u) => u.usuario },
    { key: 'nombre', label: 'Nombre', value: (u) => u.nombre },
    { key: 'email', label: 'Correo', value: (u) => u.email },
    { key: 'rol', label: 'Rol', value: (u) => u.rol },
    { key: 'activo', label: 'Estado', value: (u) => (u.activo ? 1 : 0) },
    { key: 'mfa_activo', label: 'Segundo factor', sortable: false, value: (u) => (u.mfa_activo ? 'Sí' : 'No') },
    { key: 'debe_cambiar_clave', label: 'Debe cambiar clave', sortable: false, value: (u) => (u.debe_cambiar_clave ? 'Sí' : 'No') },
    { key: 'ultimo_login', label: 'Último acceso', value: (u) => formatoFechaHora(u.ultimo_login) },
    { key: 'acciones', label: 'Acciones', sortable: false, align: 'end', value: () => '' },
  ];

  protected readonly usuarioId = (u: Usuario) => u.id_usuario;
  protected readonly fechaHora = formatoFechaHora;
  protected readonly motivoPropiaCuenta = MOTIVO_PROPIA_CUENTA;

  /** My own account: the API refuses these actions on it, so the buttons are disabled (the server still decides). */
  protected esYo(u: Usuario): boolean {
    return u.id_usuario === this.auth.sesion()?.id_usuario;
  }

  // ---------- Dialogs ----------

  /** `undefined` = closed, `null` = new user. */
  protected readonly editando = signal<Usuario | null | undefined>(undefined);
  protected readonly accion = signal<Accion | null>(null);
  protected readonly procesando = signal(false);
  protected readonly claveTemporal = signal<ClaveTemporal | null>(null);
  /** Whose open sessions are being looked at. */
  protected readonly verSesionesDe = signal<Usuario | null>(null);

  protected readonly dialogoAccion = computed(() => {
    const a = this.accion();
    if (!a) return { titulo: '', mensaje: '', texto: 'Confirmar', peligro: false };
    const nombre = a.usuario.nombre;
    switch (a.tipo) {
      case 'estado':
        return a.usuario.activo
          ? { titulo: 'Desactivar usuario', mensaje: `¿Desactivar a ${nombre}? No podrá ingresar y se cerrarán sus sesiones.`, texto: 'Desactivar', peligro: true }
          : { titulo: 'Activar usuario', mensaje: `¿Activar a ${nombre}? Podrá ingresar de nuevo.`, texto: 'Activar', peligro: false };
      case 'desbloquear':
        return { titulo: 'Desbloquear usuario', mensaje: `¿Quitar el bloqueo de ${nombre}? Podrá intentar ingresar de inmediato.`, texto: 'Desbloquear', peligro: false };
      case 'clave':
        return {
          titulo: 'Restablecer clave',
          mensaje: `Se generará una clave temporal para ${nombre}, se cerrarán sus sesiones y tendrá que cambiarla al ingresar. La clave temporal se muestra una sola vez.`,
          texto: 'Restablecer clave',
          peligro: true,
        };
      case 'sesiones':
        return {
          titulo: 'Cerrar sus sesiones',
          mensaje: this.esYo(a.usuario)
            ? 'Se cerrarán todas tus sesiones, incluida esta: tendrás que iniciar sesión de nuevo.'
            : `Se cerrarán todas las sesiones abiertas de ${nombre}. Su acceso se corta en segundos y tendrá que iniciar sesión de nuevo. Úsalo si perdió un equipo o sospechas de su cuenta.`,
          texto: 'Cerrar sus sesiones',
          peligro: true,
        };
      case 'mfa':
        return {
          titulo: 'Restablecer segundo factor',
          mensaje: `${nombre} perderá su segundo factor actual, se cerrarán sus sesiones y tendrá que configurarlo de nuevo la próxima vez que entre. Hazlo solo si la persona perdió su autenticador y confirmaste su identidad.`,
          texto: 'Sí, restablecer segundo factor',
          peligro: true,
        };
    }
  });

  protected cambiarFiltroRol(valor: string): void {
    this.filtroRol.set(valor as FiltroRol);
  }

  protected cambiarFiltroActivo(valor: string): void {
    this.filtroActivo.set(valor as FiltroActivo);
  }

  protected alGuardar(guardado: UsuarioGuardado): void {
    const nuevo = this.editando() === null;
    this.editando.set(undefined);
    this.toast.exito(nuevo ? `Usuario "${guardado.usuario.usuario}" creado.` : `Usuario "${guardado.usuario.usuario}" actualizado.`);
    if (guardado.clave_temporal) {
      this.claveTemporal.set({ usuario: guardado.usuario.usuario, clave: guardado.clave_temporal });
    }
    this.listado.recargar();
  }

  protected confirmarAccion(): void {
    const a = this.accion();
    if (!a || this.procesando()) return;
    const id = a.usuario.id_usuario;
    this.procesando.set(true);
    let peticion: Observable<Usuario | UsuarioConClaveTemporal>;
    switch (a.tipo) {
      case 'estado':
        peticion = this.repo.cambiarEstado(id, !a.usuario.activo);
        break;
      case 'desbloquear':
        peticion = this.repo.desbloquear(id);
        break;
      case 'clave':
        peticion = this.repo.restablecerClave(id);
        break;
      case 'mfa':
        peticion = this.repo.restablecerMfa(id);
        break;
      case 'sesiones':
        peticion = this.repo.cerrarSesiones(id);
        break;
    }
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (respuesta) => {
        this.procesando.set(false);
        this.accion.set(null);
        this.avisarExito(a, respuesta);
        this.listado.recargar();
      },
      error: (fallo: unknown) => {
        this.procesando.set(false);
        this.accion.set(null);
        const { mensaje, supportRef } = this.errores.describe(fallo);
        this.toast.error(mensaje, supportRef);
      },
    });
  }

  private avisarExito(a: Accion, respuesta: Usuario | UsuarioConClaveTemporal): void {
    const usuario = a.usuario.usuario;
    switch (a.tipo) {
      case 'estado':
        this.toast.exito(`Usuario "${usuario}" ${a.usuario.activo ? 'desactivado' : 'activado'}.`);
        break;
      case 'desbloquear':
        this.toast.exito(`Usuario "${usuario}" desbloqueado.`);
        break;
      case 'clave':
        this.toast.exito(`Clave de "${usuario}" restablecida.`);
        if ('clave_temporal' in respuesta) {
          this.claveTemporal.set({ usuario, clave: respuesta.clave_temporal });
        }
        break;
      case 'sesiones':
        this.toast.exito(`Se cerraron las sesiones de "${usuario}".`);
        break;
      case 'mfa':
        this.toast.exito(`Segundo factor de "${usuario}" restablecido: lo configurará al ingresar.`);
        break;
    }
  }
}
