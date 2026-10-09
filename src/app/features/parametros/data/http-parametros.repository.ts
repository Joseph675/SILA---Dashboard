import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Parametro } from '../models/parametros.models';
import { ParametrosRepository } from './parametros.repository';

@Injectable({ providedIn: 'root' })
export class HttpParametrosRepository extends ParametrosRepository {
  private readonly api = inject(ApiService);

  listar(): Observable<Parametro[]> {
    return this.api.get<Parametro[]>('parametros');
  }

  actualizar(clave: string, valor: number): Observable<Parametro> {
    return this.api.put<Parametro>(`parametros/${encodeURIComponent(clave)}`, { valor });
  }
}
