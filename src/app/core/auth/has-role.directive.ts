import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService, Rol } from '../services/auth.service';

/**
 * `<button *hasRole="'ADMIN'">` renders its host only for that role (ADMIN
 * also passes OPERATIVO checks).
 *
 * IMPORTANT: hiding a control is NOT security. The API and the database
 * reject the operation anyway with error 20008.
 */
@Directive({ selector: '[hasRole]' })
export class HasRoleDirective {
  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef);
  private readonly container = inject(ViewContainerRef);

  readonly hasRole = input.required<Rol>();

  constructor() {
    effect(() => {
      const visible = this.auth.rol() !== null && this.auth.hasRole(this.hasRole());
      this.container.clear();
      if (visible) {
        this.container.createEmbeddedView(this.template);
      }
    });
  }
}
