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

## Appointments and scheduling

Internal clinic scheduling is available at `/appointments` and `/appointments/create`. Doctor weekly schedules are authoritative for working periods, breaks, slot alignment, and appointment duration. The API converts tenant-local dates and times through the tenant's IANA timezone and stores appointment timestamps as UTC `timestamp with time zone` values. Ambiguous or nonexistent daylight-saving times, and appointments crossing a daylight-saving offset transition, are rejected.

PostgreSQL exclusion constraints protect both doctor and patient time ranges using half-open `[start, end)` intervals scoped by `TenantId`. Only cancelled appointments are excluded from these constraints, so cancellation releases a slot while completed and no-show appointments preserve the historical occupancy of their original time. Application conflict checks provide early feedback, while the database constraints remain authoritative under concurrent requests. Public booking and holiday/calendar rules are intentionally not part of this phase and must reuse this scheduling engine later.

## Dental chart and clinical examinations

- Permanent teeth use validated FDI numbers and stable GUID tooth references; the catalog can be extended for primary dentition later.
- Findings, procedures, normalized surfaces, examination notes, and multi-canal endodontic records are separate historical records. UI colors are centralized presentation metadata, never clinical truth.
- Examinations open only from an in-progress appointment after verifying its tenant, patient, and assigned doctor. Draft writes carry a GUID concurrency token and stale requests return HTTP 409.
- Completed examinations are immutable through the domain and API, with a PostgreSQL guard against subsequent examination updates or deletion. A future amendment can reference the completed record instead of rewriting it.
- The patient chart is a focused projection over completed records. Recent history omits clinical free text, and detailed records load only on demand.
- Tenant-aware composite foreign keys protect the patient, appointment, doctor, creator, examination, and all child records in addition to application authorization and query filters.

## Prescriptions

Prescriptions are tenant-owned clinical documents with concurrency-safe `RX-000001` numbering, optional appointment/examination/treatment references, medication snapshots, and Draft → Issued/Cancelled lifecycle rules. Issued content is immutable in the domain and application layers; PostgreSQL triggers also reject item mutations, deletion, or content changes while allowing only the explicit Issued → Cancelled transition.

PDF and QR generation sit behind application abstractions. PDF download and print operations require their respective prescription permissions and apply the same tenant/doctor visibility rules as details. Each issued prescription receives a cryptographically random 256-bit document reference. The QR contains only the reserved verification path plus that opaque reference—never a patient name, medication, clinical note, database ID, or access token. No public verification or sharing endpoint is enabled in this phase; a future controlled route must retain authorization (or introduce an explicitly reviewed limited-disclosure policy) before the reserved QR destination becomes externally resolvable.

The current PDF renderer produces a compact Latin-font document with clinic, doctor, patient, medication directions, verification reference, and signature placeholder. Arabic/non-Latin PDF font shaping and tenant logo embedding remain future renderer work; the Angular UI itself supports Arabic/English and RTL/LTR. Speech-to-text is an unconfigured abstraction only and cannot create or issue prescriptions automatically.

## CRM and follow-ups

The clinic CRM is intentionally patient-centric: `Patient` remains the canonical identity and no duplicate customer/lead table exists. `/crm` provides database-aggregated new-patient and follow-up indicators, while `/crm/follow-ups` uses server-side search, filters, sorting, and pagination. Due dates are entered in the tenant's local timezone, rejected when DST makes the local time invalid or ambiguous, stored as UTC, and rendered in the configured tenant timezone.

Follow-ups support Pending, InProgress, Completed, and Cancelled states. Overdue is derived at query time from open status plus `DueAt`; it is not stored. GUID concurrency tokens protect edits and assignment, and a PostgreSQL trigger prevents terminal records from being changed or deleted. All patient, assignee, appointment, treatment plan, treatment, prescription, and activity relationships use tenant-aware composite foreign keys.

`IFollowUpCreator` is the extension point for future appointment, treatment, and prescription automation. This phase does not automatically create follow-ups and does not contact patients. Communication activities record concise Call/WhatsApp/SMS/Email/Other metadata only; no provider credentials, delivery logic, campaigns, or full private message bodies are introduced.

## Finance and ERP foundation

- Completed treatments create one immutable revenue record from the treatment price snapshot. A tenant-scoped unique source constraint makes posting idempotent.
- Payments represent received cash separately from earned revenue. PostgreSQL locks the revenue row and validates balance, currency, patient, and treatment before insertion.
- Expenses, doctor percentage costs, and the financial transaction index are immutable posted records. Future corrections must use reversal records rather than deletion.
- Doctor costs reuse the compensation rule effective on the treatment date. Fixed salary is never allocated per treatment; combined rules contribute only their percentage component.
- Patient balances and dashboard summaries use SQL aggregation. Date filters convert clinic-local boundaries to UTC.
- Finance uses tenant filters and granular permissions. Doctors have no finance access by default; receptionists have payment-focused access without dashboard, expense, or compensation visibility.
