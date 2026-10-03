import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, tap } from 'rxjs';

export interface LoginResponse {
  accessToken: string;
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

  readonly authenticated = signal(Boolean(localStorage.getItem('access_token')));
  readonly permissions = signal<string[]>(this.readPermissions());
  readonly userId = signal<string>(localStorage.getItem('user_id') ?? '');
  readonly displayName = signal<string>(localStorage.getItem('display_name') ?? 'User');
  readonly tenantId = signal<string>(localStorage.getItem('tenant_id') ?? '');
  readonly tenantName = signal<string>(localStorage.getItem('tenant_name') ?? '');
  readonly clinics = signal<ClinicAccessSummary[]>(this.readClinics());

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  refreshPermissions() {
    return this.http.get<string[]>('/api/auth/permissions').pipe(tap(value => {
      localStorage.setItem('permissions', JSON.stringify(value));
      this.permissions.set(value);
    }));
  }

  refreshClinics() {
    return this.http.get<ClinicAccessSummary[]>('/api/auth/clinics').pipe(tap(value => {
      localStorage.setItem('clinics', JSON.stringify(value));
      this.clinics.set(value);
    }));
  }

  setDisplayName(name: string): void {
    if (!name) return;
    localStorage.setItem('display_name', name);
    this.displayName.set(name);
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password, preferredTenantId: localStorage.getItem('last_tenant_id') }).pipe(
      tap((result) => this.applySession(result)),
    );
  }

  switchClinic(tenantId: string) {
    return this.http.post<LoginResponse>('/api/auth/switch-clinic', { tenantId }).pipe(
      tap(result => this.applySession(result)),
    );
  }

  private applySession(result: LoginResponse): void {
    localStorage.setItem('access_token', result.accessToken);
    localStorage.setItem('user_id', result.userId);
    localStorage.setItem('display_name', result.displayName);
    localStorage.setItem('permissions', JSON.stringify(result.permissions));
    localStorage.setItem('tenant_id', result.tenantId);
    localStorage.setItem('last_tenant_id', result.tenantId);
    localStorage.setItem('tenant_name', result.tenantName);
    localStorage.setItem('clinics', JSON.stringify(result.clinics));
    this.userId.set(result.userId);
    this.displayName.set(result.displayName);
    this.permissions.set(result.permissions);
    this.tenantId.set(result.tenantId);
    this.tenantName.set(result.tenantName);
    this.clinics.set(result.clinics);
    this.authenticated.set(true);
    this.authReset$.next();
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('display_name');
    localStorage.removeItem('permissions');
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('tenant_name');
    localStorage.removeItem('clinics');
    this.userId.set('');
    this.displayName.set('User');
    this.permissions.set([]);
    this.tenantId.set('');
    this.tenantName.set('');
    this.clinics.set([]);
    this.authenticated.set(false);
    this.authReset$.next();
  }

  private readPermissions(): string[] {
    try {
      return JSON.parse(localStorage.getItem('permissions') ?? '[]') as string[];
    } catch {
      return [];
    }
  }

  private readClinics(): ClinicAccessSummary[] {
    try { return JSON.parse(localStorage.getItem('clinics') ?? '[]') as ClinicAccessSummary[]; }
    catch { return []; }
  }
}



