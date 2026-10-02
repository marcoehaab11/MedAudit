# MedDentist Production Deployment Checklist

## 1. Environment & Configuration
- [x] Set `ASPNETCORE_ENVIRONMENT=Production` on all application instances.
- [x] Configure `Authentication__Jwt__SigningKey` with minimum 32-character high-entropy secret.
- [x] Configure `ConnectionStrings__Postgres` with SSL mode enabled (`SslMode=Require`).
- [x] Configure `ConnectionStrings__Redis` with password authentication and abortConnect=false.

## 2. Security & Secrets Management
- [x] Verify no hardcoded secrets, connection strings, or private keys exist in Git repository.
- [x] Inject secrets via environment variables or cloud key vaults.
- [x] Verify API endpoints return OWASP security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `CSP`, `Permissions-Policy`).
- [x] Verify error responses return RFC 7807 `ProblemDetails` with stack traces masked in Production.

## 3. Rate Limiting & Traffic Protection
- [x] IP-based rate limiting enabled for `/api/auth/login` (5 requests/min).
- [x] IP-based rate limiting enabled for `/api/public/bookings` (10 requests/min).
- [x] Tenant-aware rate limiting enabled for report exports (20 requests/min).
- [x] Nginx reverse proxy rate limit zones configured (`api_limit: 30r/s`, `booking_limit: 5r/s`).
- [x] Maximum request body size capped at 10MB across Nginx and API.

## 4. Multi-Tenant Data Isolation Audit
- [x] All tenant-scoped entities configured with EF Core Global Query Filters (`TenantId == currentTenant.TenantId`).
- [x] All `.IgnoreQueryFilters()` calls in codebase verified to enforce parameter-driven tenant restrictions or `IsPlatformAdmin` checks.

## 5. Infrastructure & Containerization
- [x] All backend containers (`api`, `worker`, `platform-admin`) execute as non-root user (`USER $APP_UID`).
- [x] Docker Compose configured with HTTP readiness healthchecks (`/health/ready`).
- [x] Nginx reverse proxy properly forwards `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`.

## 6. Observability & Health Monitoring
- [x] Endpoint `/health/live` returns HTTP 200 without checking external infrastructure dependencies.
- [x] Endpoint `/health/ready` validates PostgreSQL and Redis connection health before routing traffic.
- [x] Serilog structured logging configured with request correlation IDs (`X-Correlation-ID`).

## 7. Operations & Rollback Protocol
- [x] Database migrations executed and verified (`dotnet ef database update`).
- [x] Backup script configured with daily GPG AES-256 encrypted dumps and WAL archiving.
- [x] Rollback procedure tested: container image tag rollback and point-in-time database restore.

## 8. Operations monitoring

- The Platform Admin **Operations** page records API, clinic app, and booking app checks every minute. The API readiness check includes PostgreSQL and Redis.
- Set `MONITOR_ALERT_EMAIL` plus `SMTP_HOST`, `SMTP_FROM`, and any SMTP authentication values in the deployment environment to receive email on service failure and recovery. Without SMTP, incidents still appear in the admin dashboard.
- The GitHub Actions `Planora production health` workflow checks the public API and admin readiness URLs every 10 minutes. It opens one GitHub issue while either endpoint is unavailable and closes it after recovery. GitHub issue notifications depend on repository notification settings and Actions permissions.
- If production domains change, set repository variables `PLANORA_API_HEALTH_URL` and `PLANORA_ADMIN_HEALTH_URL`. The defaults are the current `medaudit.online` hostnames.
- Internal monitoring cannot report while the database or admin service itself is unavailable; the GitHub workflow covers this case. A clinic with no recent usage is not automatically treated as down.
