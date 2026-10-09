import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CanalSesion } from './canal-sesion.service';

/**
 * When another tab signs out, this one drops its in-memory session and goes to the login.
 * The first tab already told the server, so no API call is made here.
 * Instantiated at app start (see `app.config.ts`).
 */
@Injectable({ providedIn: 'root' })
export class SincronizacionPestanas {
  constructor() {
    const auth = inject(AuthService);
    const router = inject(Router);
    inject(CanalSesion).escuchar((mensaje) => {
      if (mensaje.tipo !== 'logout' || !auth.isAuthenticated()) return;
      auth.limpiarSesion();
      void router.navigate(['/login'], { queryParams: { aviso: mensaje.motivo === 'inactividad' ? 'inactividad' : 'otra-pestana' } });
    });
  }
}
