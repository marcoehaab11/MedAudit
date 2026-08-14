# Dental Clinic SaaS Foundation

Production-oriented foundation for a multi-tenant dental clinic SaaS. This delivery intentionally contains no patient, appointment, dental chart, treatment, prescription, CRM, finance, or reporting features.

## Architecture

The backend is a Clean Architecture modular monolith:

```text
DentalClinic.Domain          independent business primitives
        ↑
DentalClinic.Application     use-case contracts and tenant guard
        ↑
DentalClinic.Infrastructure  EF Core, PostgreSQL, Identity, Redis, tenant resolution
        ↑
Api / PlatformAdmin / Worker composition roots
```

- `DentalClinic.Api`: REST host, JWT validation, structured errors, correlation IDs, and health endpoints.
- `DentalClinic.PlatformAdmin`: Razor Pages shell protected by a platform-only authorization policy.
- `DentalClinic.Worker`: tenant-aware background processing host; no business jobs are registered yet.
- `dental-clinic-app`: Angular clinic shell with English/Arabic and LTR/RTL behavior.
- `dental-clinic-public`: mobile-first Angular public shell with no internal identifiers.

All tenant-owned EF entities implement `ITenantOwned`. `ApplicationDbContext` assigns `TenantId` from the trusted authenticated claim, filters tenant reads, and rejects cross-tenant writes. A client-supplied tenant ID is never used as authorization evidence.

## Prerequisites

- .NET SDK 10.0.302 or a compatible 10.0 patch
- Node.js 24.15.0 (Angular 22 does not support odd-numbered Node 25)
- Docker Engine with Docker Compose

## Start with Docker Compose

Create local environment values; `.env` is ignored by Git:

```powershell
Copy-Item .env.example .env
```

Replace both placeholder secrets in `.env`, then build and start the stack:

```powershell
docker compose up --build -d
docker compose ps
```

Local endpoints:

- Clinic app: `http://app.localhost:8080`
- Platform Admin: `http://admin.localhost:8080` (requires a PlatformAdmin cookie)
- Public app: `http://book.localhost:8080`
- API readiness: `http://api.localhost:8080/health/ready`
- API liveness: `http://api.localhost:8080/health/live`

PostgreSQL and Redis bind only to `127.0.0.1` for local tooling. They are not published on a public interface.

## Controlled database migration

The application never applies destructive or production migrations automatically. After the containers are healthy, explicitly apply the checked-in migration:

```powershell
$env:ConnectionStrings__Postgres = "<local-postgres-connection-string>"
dotnet tool restore
dotnet tool run dotnet-ef database update --project src/DentalClinic.Infrastructure --startup-project src/DentalClinic.Infrastructure
```

For staging and production, run the same controlled migration step with secrets supplied by the deployment environment and require approval before production.

## Run without Docker application containers

Start only dependencies:

```powershell
docker compose up -d postgres redis
$env:ConnectionStrings__Postgres = "<local-postgres-connection-string>"
$env:ConnectionStrings__Redis = "localhost:6379,abortConnect=false"
$env:Authentication__Jwt__SigningKey = "<at-least-32-random-characters>"
dotnet run --project src/DentalClinic.Api
```

JWT tenant users carry a trusted `tenant_id` GUID claim issued after an active account successfully authenticates. Platform administrators carry the `PlatformAdmin` role and must not carry a tenant claim.

Run either frontend from its directory with Node 24.15.0:

```powershell
npm ci
npm start
```

## Verification

```powershell
dotnet restore DentalClinic.slnx --configfile NuGet.Config
dotnet build DentalClinic.slnx --configuration Release --no-restore
dotnet test DentalClinic.slnx --configuration Release --no-build

Set-Location frontend/dental-clinic-app
npm ci
npm run build
npm test -- --watch=false
```

Repeat the frontend commands for `frontend/dental-clinic-public`.

Integration tests use a disposable real PostgreSQL container and verify query isolation, trusted tenant assignment, and cross-tenant write rejection. Docker must be running. Architecture tests enforce inward dependency direction.

## Configuration and security

- Secrets and real connection strings belong in environment variables or a secret manager, never Git.
- Production traffic must terminate HTTPS at the reverse proxy.
- PostgreSQL and Redis must remain on internal networks in production.
- Logs contain correlation IDs and safe tenant/user identifiers only; never medical content or tokens.
- Redis keys, jobs, files, reports, and future caches must include and validate tenant context.
- Backups must be encrypted, stored off-host, retained by policy, and restore-tested.

CI builds and tests the backend, builds and tests both Angular apps, checks vulnerable dependencies, and builds every production image. Production deployment, backup credentials, and infrastructure-specific monitoring remain environment-owned concerns.

## Platform tenant management

Authenticated platform administrators manage clinics through:

- `/admin/clinics`
- `/admin/clinics/create`
- `/admin/clinics/{id}`
- `/admin/clinics/{id}/edit`

Clinic creation is transactional across the tenant, passwordless Identity user, ClinicAdmin role association, minimal tenant defaults, invitation, and audit records. Invitation tokens are generated with cryptographic randomness and only their SHA-256 hashes are stored. The current notifier is an infrastructure abstraction that records safe delivery metadata without logging or persisting the token; connect a real email provider before production invitations are enabled.

## Identity and clinic users

Clinic identity management is available in the Angular application at `/users`, with invitation acceptance at `/accept-invitation?token=...` and login at `/login`. ASP.NET Core Identity stores credentials; tenant-owned `clinic_users`, `tenant_roles`, `role_permissions`, and `user_role_assignments` store application profiles and authorization data. Built-in ClinicAdmin, Doctor, and Receptionist roles are initialized per tenant, while custom tenant roles can be created through the permission-protected API.

Permission policies are enforced by the API and rechecked by application use cases. Effective permissions are resolved from the current tenant's role assignments. PlatformAdmin remains a platform-only Identity role and cannot be assigned through clinic role endpoints. Deactivated users and users belonging to inactive or suspended clinics cannot authenticate.

The email notifier remains provider-agnostic and deliberately does not log raw invitation tokens. A production email provider and its public invitation URL must be configured before real invitations can be delivered.
