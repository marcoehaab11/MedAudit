# Multi-branch clinic plan

The business is one clinic with multiple physical branches. To reuse the existing comprehensive data isolation, each branch has a tenant workspace linked to a parent clinic. The parent clinic owns the subscription and consolidated management. The original tenant is the default branch, so existing data keeps its IDs and branch attribution.

1. Link branch workspaces to the original clinic. Keep existing records in the original branch. The earlier shared-account mechanism becomes the branch membership and switch mechanism; limit switching to branches of the same clinic.
2. Let the clinic administrator create a branch with its own address, phone, hours, booking page, settings, and operational data. Initialize roles and finance categories for each branch.
3. Give staff one active branch membership. An authorized administrator transfers a staff member by deactivating the old membership and creating a new one with mapped roles and permissions, preserving old work under the old branch.
4. Give patients one active branch record. Transfer with a distinct new patient record at the target and a protected link to historical clinical records at the source. Leave old appointments and finances under the source branch.
5. Use the tenant boundary to isolate all operational modules, including inventory, finance, labs, insurance, booking, and communications. Shared subscription validity comes from the parent clinic.
6. Show per-branch and consolidated totals to authorized managers. Keep per-branch booking links and QR codes, and add a clinic-wide branch directory.
7. Provide parent-level backup/restore across all branches without rewriting historical tenant IDs. The current restore requires the same clinic and branch IDs to exist. Validate branch creation, cross-branch access denial, staff and patient transfer, subscription enforcement, finance totals, and backup on PostgreSQL before production rollout.

The agreed default is one active branch for staff and patients; a transfer is explicit and audited.

Current verification: .NET and Angular builds, unit tests, architecture tests, and EF model/migration check pass. PostgreSQL integration coverage and a restore rehearsal remain open because the local Docker runtime was unavailable. Off-server backup storage and rebuilding a clinic from a group backup on an empty database remain separate recovery work.
