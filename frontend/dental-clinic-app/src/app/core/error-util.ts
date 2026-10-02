import { HttpErrorResponse } from '@angular/common/http';

export function parseApiError(error: unknown, fallbackMessage: string): string {
  if (!error) return fallbackMessage;

  if (error instanceof HttpErrorResponse || (typeof error === 'object' && error !== null && 'error' in error)) {
    const httpErr = error as HttpErrorResponse;
    const body = httpErr.error;

    if (body) {
      if (typeof body === 'string') {
        return body;
      }

      if (body.errors && typeof body.errors === 'object') {
        const errorList: string[] = [];
        for (const [key, val] of Object.entries(body.errors)) {
          if (Array.isArray(val)) {
            errorList.push(`${key}: ${val.join(', ')}`);
          } else if (typeof val === 'string') {
            errorList.push(`${key}: ${val}`);
          }
        }
        if (errorList.length > 0) {
          return errorList.join(' | ');
        }
      }

      if (body.detail) return body.detail;
      if (body.message) return body.message;
      if (body.title) return body.title;
    }

    if (httpErr.status === 400) return 'Invalid request data. Please verify form fields.';
    if (httpErr.status === 401) return 'Session expired. Please sign in again.';
    if (httpErr.status === 403) return 'You do not have permission to perform this action.';
    if (httpErr.status === 404) return 'The requested resource was not found.';
    if (httpErr.status === 409) return body?.detail || body?.message || 'A conflict occurred. The resource may have been updated or already exists.';
    if (httpErr.status >= 500) return 'A server error occurred. Please try again later.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

