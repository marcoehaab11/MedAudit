import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, catchError, finalize, map, Observable, of, shareReplay, tap } from 'rxjs';

export interface LoginResponse {
  expiresAt: string;
  userId: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  tenantId: string;
  tenantName: string;
  clinics: ClinicAccessSummary[];
}
export interface ClinicAccessSummary { tenantId: string; name: string; accessible: boolean }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authReset$ = new Subject<void>();
  readonly onAuthReset$ = this.authReset$.asObservable();
  readonly authenticated = signal(false);
  readonly permissions = signal<string[]>([]);
  readonly roles = signal<string[]>([]);
  readonly userId = signal('');
  readonly displayName = signal('User');
  readonly tenantId = signal('');
  readonly tenantName = signal('');
  readonly clinics = signal<ClinicAccessSummary[]>([]);
  private restoring?: Observable<boolean>;

  constructor() { this.removeLegacyIdentity(); }

  hasPermission(permission: string): boolean { return this.permissions().includes(permission); }

  restoreSession(): Observable<boolean> {
    if (!this.restoring) this.restoring = this.http.get<LoginResponse>('/api/auth/session').pipe(
      tap(result => this.applySession(result)), map(() => true),
      catchError(() => { this.clearSession(); return of(false); }),
      finalize(() => this.restoring = undefined), shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.restoring;
  }

  refreshPermissions() {
    return this.http.get<string[]>('/api/auth/permissions').pipe(tap(value => this.permissions.set(value)));
  }
  refreshClinics() {
    return this.http.get<ClinicAccessSummary[]>('/api/auth/clinics').pipe(tap(value => this.clinics.set(value)));
  }
  setDisplayName(_name: string): void { this.restoreSession().subscribe(); }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password }).pipe(tap(result => this.applySession(result)));
  }
  switchClinic(tenantId: string) {
    return this.http.post<LoginResponse>('/api/auth/switch-clinic', { tenantId }).pipe(tap(result => {
      this.applySession(result); this.notifyOtherTabs();
    }));
  }
  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}).pipe(tap(() => {
      this.clearSession(); this.notifyOtherTabs();
    }));
  }
  clearSession(): void {
    const wasAuthenticated = this.authenticated();
    this.removeLegacyIdentity();
    this.roles.set([]); this.userId.set(''); this.displayName.set('User'); this.permissions.set([]);
    this.tenantId.set(''); this.tenantName.set(''); this.clinics.set([]); this.authenticated.set(false);
    if (wasAuthenticated) this.authReset$.next();
  }
  private applySession(result: LoginResponse): void {
    const changed = !this.authenticated() || this.userId() !== result.userId || this.tenantId() !== result.tenantId;
    this.removeLegacyIdentity();
    this.roles.set(result.roles); this.userId.set(result.userId); this.displayName.set(result.displayName);
    this.permissions.set(result.permissions); this.tenantId.set(result.tenantId); this.tenantName.set(result.tenantName);
    this.clinics.set(result.clinics); this.authenticated.set(true);
    if (changed) this.authReset$.next();
  }
  private removeLegacyIdentity(): void {
    try {
      for (const key of ['access_token', 'roles', 'user_id', 'display_name', 'permissions', 'tenant_id', 'tenant_name', 'clinics', 'last_tenant_id']) localStorage.removeItem(key);
    } catch { /* A browser blocking local storage must not disable server sessions. */ }
  }
  private notifyOtherTabs(): void {
    try { localStorage.setItem('session_changed', String(Date.now())); } catch {}
  }
}
