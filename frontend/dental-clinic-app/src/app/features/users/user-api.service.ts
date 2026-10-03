import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface RoleSummary {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
}
export interface UserListItem {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  status: number;
  roles: string[];
  createdAt: string;
}
export interface UserDetails extends Omit<UserListItem, 'roles'> {
  roles: RoleSummary[];
  updatedAt: string;
  customPermissions: string[] | null;
  effectivePermissions: string[];
}
export interface RoleDetails extends RoleSummary { permissions: string[] }
export interface PagedUsers {
  items: UserListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly http = inject(HttpClient);

  users(search: string, roleId: string, status: string, page: number) {
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (search) params = params.set('search', search);
    if (roleId) params = params.set('roleId', roleId);
    if (status) params = params.set('status', status);
    return this.http.get<PagedUsers>('/api/users', { params });
  }
  user(id: string) {
    return this.http.get<UserDetails>(`/api/users/${id}`);
  }
  roles() {
    return this.http.get<RoleSummary[]>('/api/roles');
  }
  role(id: string) { return this.http.get<RoleDetails>(`/api/roles/${id}`); }
  permissionCatalog() { return this.http.get<string[]>('/api/roles/permission-catalog'); }
  createUser(value: { displayName: string; email: string; password: string; phone?: string; roleIds: string[]; permissions?: string[] | null }) {
    return this.http.post<{ id: string }>('/api/users', value);
  }
  invite(value: { displayName: string; email: string; phone?: string; roleIds: string[]; permissions?: string[] | null }) {
    return this.http.post<{ id: string }>('/api/users/invitations', value);
  }
  update(id: string, value: { displayName: string; phone?: string }) {
    return this.http.put<void>(`/api/users/${id}`, value);
  }
  setActive(id: string, active: boolean) {
    return this.http.post<void>(`/api/users/${id}/${active ? 'activate' : 'deactivate'}`, {});
  }
  assignRoles(id: string, roleIds: string[]) {
    return this.http.put<void>(`/api/users/${id}/roles`, { roleIds });
  }
  setPermissions(id: string, permissions: string[] | null) {
    return this.http.put<void>(`/api/users/${id}/permissions`, { permissions });
  }
}

