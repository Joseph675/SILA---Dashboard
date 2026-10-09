import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { iniciales } from '../../shared/utils/formato-co';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';

/** Header menu of the signed-in user: name, role, "Mi cuenta" and "Cerrar sesión". */
@Component({
  selector: 'app-user-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink, StatusChipComponent],
  template: `
    @if (sesion(); as s) {
      <div class="relative">
        <button
          #disparador
          type="button"
          class="flex h-9 items-center gap-2 rounded-lg px-2 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          aria-haspopup="menu"
          [attr.aria-expanded]="abierto()"
          (click)="alternar()"
        >
          <span class="grid size-7 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary" aria-hidden="true">{{ iniciales() }}</span>
          <span class="hidden max-w-32 truncate font-medium md:inline">{{ s.nombre }}</span>
          <app-icon name="lucideChevronDown" class="size-3.5 text-muted-foreground" aria-hidden="true" />
        </button>

        @if (abierto()) {
          <div class="absolute end-0 z-40 mt-2 w-64 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl" role="menu" aria-label="Menú de usuario">
            <div class="px-3 py-2">
              <p class="truncate text-sm font-semibold">{{ s.nombre }}</p>
              <p class="mb-1.5 truncate text-xs text-muted-foreground">{{ s.usuario }}</p>
              <app-status-chip [texto]="s.rol === 'ADMIN' ? 'Administrador' : 'Operativo'" tono="info" />
            </div>
            <div class="my-1 h-px bg-border"></div>
            <a routerLink="/cuenta" role="menuitem" class="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" (click)="cerrarMenu()">
              <app-icon name="lucideUserCog" class="size-4" aria-hidden="true" />
              Mi cuenta
            </a>
            <button type="button" role="menuitem" class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" (click)="cerrarSesion()">
              <app-icon name="lucideLogOut" class="size-4" aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class UserMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elemento: ElementRef<HTMLElement> = inject(ElementRef);

  protected readonly sesion = computed(() => this.auth.sesion());
  protected readonly abierto = signal(false);
  protected readonly iniciales = computed(() => iniciales(this.sesion()?.nombre ?? ''));

  protected alternar(): void {
    this.abierto.update((v) => !v);
  }

  protected cerrarMenu(): void {
    this.abierto.set(false);
  }

  protected cerrarSesion(): void {
    this.abierto.set(false);
    this.auth.cerrarSesion().subscribe(() => void this.router.navigate(['/login']));
  }

  @HostListener('document:click', ['$event'])
  protected alHacerClicFuera(evento: MouseEvent): void {
    if (this.abierto() && !this.elemento.nativeElement.contains(evento.target as Node)) {
      this.abierto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected alPresionarEscape(): void {
    if (this.abierto()) {
      this.abierto.set(false);
      this.elemento.nativeElement.querySelector<HTMLElement>('button')?.focus();
    }
  }
}
