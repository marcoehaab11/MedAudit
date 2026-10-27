# Clinic registration and platform email

Public pages: `/register`, `/confirm-email`. Clinic app pages: `/forgot-password`, `/reset-password`.

Before enabling registrations, open the platform administrator's **Email / SMTP** page (`/admin/email`). Save the SMTP host, STARTTLS port (usually 587), username, password, sender email/name, public landing URL, and clinic application URL. The URL fields must point to the external HTTPS addresses, not container hostnames. Send a test and inspect the recipient inbox and Email delivery table. SMTP port 465 with implicit TLS is not supported by the current transport.

Email delivery runs in the API process every 15 seconds. Messages are stored in PostgreSQL, leased to avoid concurrent sends, and retried up to five times. Failed messages can be retried from the administrator page. SMTP acceptance is shown as Sent; it does not prove inbox placement. Confirmation/reset links expire after one hour; users should request a fresh link if expired. A crash after SMTP acceptance may produce a duplicate email on retry, but confirmation is idempotent and never restarts the trial.

Registration creates an unconfirmed identity and a pending registration. No clinic membership or usable clinic exists until the email is verified. Confirmation atomically creates the clinic, defaults, active owner membership and a trial lasting exactly 15 days, and queues the welcome email. Expiry uses existing subscription enforcement. Extending the subscription from clinic details converts the trial to a subscription. Existing email identities are never attached to a public signup; existing users should sign in or recover their password.

**Registrations & trials** (`/admin/registrations`) lists pending registrations, verified clinics, trial expiry, and customer section controls. Logo uploads accept PNG/JPEG up to 1 MB. Public customer cards require clinic consent, administrator publication, and an active clinic subscription. Existing clinics can be listed only after consent has been obtained.

SMTP secrets and token-bearing message bodies use ASP.NET Data Protection. API, admin and worker use application name Planora and must share persistent keys. Docker Compose provides the `data-protection-keys` volume. Back up this volume together with the database. Outside Docker, set `DataProtection__KeyPath` to a shared persistent directory.

The migration `ClinicSelfRegistrationAndPlatformMail` adds pending registrations, mail settings/queue and trial/showcase fields; existing clinics retain their subscription dates and remain unpublished by default. Apply via the existing deployment migration startup.
