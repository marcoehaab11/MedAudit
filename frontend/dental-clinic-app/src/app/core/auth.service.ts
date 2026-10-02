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
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authReset$ = new Subject<void>();
  readonly onAuthReset$ = this.authReset$.asObservable();

  readonly authenticated = signal(Boolean(localStorage.getItem('access_token')));
  readonly permissions = signal<string[]>(this.readPermissions());
  readonly userId = signal<string>(localStorage.getItem('user_id') ?? '');
  readonly displayName = signal<string>(localStorage.getItem('display_name') ?? 'User');

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  setDisplayName(name: string): void {
    if (!name) return;
    localStorage.setItem('display_name', name);
    this.displayName.set(name);
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password }).pipe(
      tap((result) => {
        localStorage.setItem('access_token', result.accessToken);
        localStorage.setItem('user_id', result.userId);
        localStorage.setItem('display_name', result.displayName);
        localStorage.setItem('permissions', JSON.stringify(result.permissions));
        this.userId.set(result.userId);
        this.displayName.set(result.displayName);
        this.permissions.set(result.permissions);
        this.authenticated.set(true);
        this.authReset$.next();
      }),
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('display_name');
    localStorage.removeItem('permissions');
    this.userId.set('');
    this.displayName.set('User');
    this.permissions.set([]);
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
}



