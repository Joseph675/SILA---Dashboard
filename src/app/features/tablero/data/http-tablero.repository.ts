import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Tablero } from '../models/tablero.models';
import { TableroRepository } from './tablero.repository';

/** HTTP implementation: `{apiBaseUrl}/api/v1/tablero`. */
@Injectable({ providedIn: 'root' })
export class HttpTableroRepository extends TableroRepository {
  private readonly api = inject(ApiService);

  obtener(): Observable<Tablero> {
    return this.api.get<Tablero>('tablero');
  }
}
