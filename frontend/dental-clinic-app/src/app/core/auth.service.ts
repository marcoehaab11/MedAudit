import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

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
  readonly authenticated = signal(Boolean(localStorage.getItem('access_token')));
  readonly permissions = signal<string[]>(this.readPermissions());

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password }).pipe(
      tap((result) => {
        localStorage.setItem('access_token', result.accessToken);
        localStorage.setItem('display_name', result.displayName);
        localStorage.setItem('permissions', JSON.stringify(result.permissions));
        this.permissions.set(result.permissions);
        this.authenticated.set(true);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('display_name');
    localStorage.removeItem('permissions');
    this.permissions.set([]);
    this.authenticated.set(false);
  }

  private readPermissions(): string[] {
    try {
      return JSON.parse(localStorage.getItem('permissions') ?? '[]') as string[];
    } catch {
      return [];
    }
  }
}
