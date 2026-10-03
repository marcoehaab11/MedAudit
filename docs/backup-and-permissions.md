# Clinic backups and per-user access

## Permissions

Clinic roles remain presets. A user can instead have a custom permission profile that replaces the role's effective permissions. The user editor groups permissions by module and offers all, view-only, and no-access choices. The API evaluates the database permission profile on every request; the app refreshes its navigation permissions on startup and route navigation. A manager cannot assign a permission they do not hold and cannot change their own permissions. A clinic administrator receives `Backup.Create` by default.

## Manual backups

The clinic app can export any combination of the displayed modules, the core set, or every module. The platform administrator can export a full copy from a clinic's details page. The output is a `.plnbak` download: a ZIP of tenant-scoped PostgreSQL rows, including stored lab and insurance documents, encrypted with AES-256-GCM using a password of at least 12 characters. The password is never stored by Planora. The file and password must be kept outside the application server.

The `settings` module also captures the clinic profile. Platform subscription status and dates are managed separately and are not overwritten by restore. The backup does not include Redis cache, running jobs, global platform administrator accounts, or server configuration/secrets.

An identity can belong to more than one clinic. The `accounts` module captures that clinic's memberships, roles, and permission profiles. If a sign-in identity is shared with another clinic, restoring this clinic preserves the live shared password and account details so another clinic's access is not changed. Identity credentials are restored from the archive only for accounts that have no other clinic membership at restore time.

## Restore

Only a platform administrator can inspect and restore a backup. The page previews the clinic, time, selected modules, table count, and row count. It requires a current full backup to be downloaded before restore. The server verifies the password, tenant ID, database migration version, module/table manifest, row counts, and SHA-256 checksums before changing data. Replacement runs in one serializable PostgreSQL transaction. A partial restore is rejected when existing records in an unselected module depend on a selected table. The archive can only be restored to the same clinic ID.

Backups made before a schema migration do not restore into a newer schema. Download a fresh backup after deploying a migration and retain a matching application build for older archives.

This is a manual file workflow. There is no scheduled backup, off-server copy, retention policy, or full-server recovery yet. Those require an external storage destination and a separate database-level recovery setup. Test a restore on a nonproduction copy before relying on this for operational recovery.
