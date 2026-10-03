# Multi-clinic accounts implementation plan

1. Keep each clinic as its own tenant. Patients, appointments, finance, booking, integrations, backup, subscription, and settings remain scoped to that tenant.
2. Separate a person's sign-in identity from their clinic membership. Migrate every existing clinic user to a membership linked to its current identity without changing user IDs or clinical references.
3. Allow an existing email to be invited into another clinic. New membership roles, permissions, status, and display name belong to that clinic. Accepting this invitation verifies the existing password rather than resetting it.
4. On login, return the accessible clinics and issue a token for one clinic. Add a clinic switch endpoint that verifies membership and issues a new scoped token. Expose a clinic switcher in the staff app.
5. Update user, doctor, and platform admin queries to resolve email through the identity link. Keep platform admin identities separate from clinic memberships.
6. Keep clinic backups isolated. A backup can restore membership and clinic data; shared sign-in credentials must not be overwritten by another clinic's restore.
7. Test migration compatibility, account reuse, cross-clinic authorization, disabled/expired clinics, clinic switching, and UI builds. Run database integration tests when PostgreSQL is available.

Each clinic keeps its own subscription and permission set. Patient records are isolated by clinic unless a separate shared-record feature is requested.
