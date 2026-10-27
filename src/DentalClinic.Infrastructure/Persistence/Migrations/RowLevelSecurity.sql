-- Run only through the migration account. Runtime logins must never own these objects.
-- All request settings are supplied by server code, never by browser identity fields.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Run this migration with the dedicated PostgreSQL owner/bypass account, never the runtime login';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'meddentist_runtime') THEN
    CREATE ROLE meddentist_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'meddentist_worker') THEN
    CREATE ROLE meddentist_worker NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
ALTER ROLE meddentist_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE meddentist_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA clinic_security;
REVOKE ALL ON SCHEMA clinic_security FROM PUBLIC;
GRANT USAGE ON SCHEMA public, clinic_security TO meddentist_runtime;

CREATE FUNCTION clinic_security.value(key text) RETURNS text LANGUAGE sql STABLE
SET search_path = pg_catalog AS $$ SELECT nullif(current_setting('meddentist.' || key, true), '') $$;
CREATE FUNCTION clinic_security.id(key text) RETURNS uuid LANGUAGE sql STABLE
SET search_path = pg_catalog AS $$ SELECT clinic_security.value(key)::uuid $$;

CREATE FUNCTION clinic_security.platform_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
 SELECT EXISTS (SELECT 1 FROM public."AspNetUsers" u
 WHERE u."Id" = clinic_security.id('identity') AND u."IsPlatformAdmin" AND u."TenantId" IS NULL
 AND (u."LockoutEnd" IS NULL OR u."LockoutEnd" <= now()))
$$;

CREATE FUNCTION clinic_security.member_of(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
 SELECT target = clinic_security.id('tenant') AND EXISTS (
 SELECT 1 FROM public.clinic_users m
 JOIN public.tenants t ON t."Id" = m."TenantId"
 JOIN public.tenants c ON c."Id" = coalesce(t."ParentClinicId", t."Id")
 JOIN public."AspNetUsers" u ON u."Id" = m."IdentityUserId"
 WHERE m."Id" = clinic_security.id('member') AND m."IdentityUserId" = clinic_security.id('identity')
 AND m."TenantId" = target AND m."Status" = 2 AND NOT u."IsPlatformAdmin"
 AND (u."LockoutEnd" IS NULL OR u."LockoutEnd" <= now())
 AND t."Status" = 1 AND c."Status" = 1
 AND c."SubscriptionStartsAt" <= now() AND c."SubscriptionExpiresAt" > now())
$$;

CREATE FUNCTION clinic_security.permission(required text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
 SELECT clinic_security.member_of(clinic_security.id('tenant')) AND coalesce(
 (SELECT required = ANY(p."Permissions") FROM public.user_permission_profiles p
 WHERE p."TenantId" = clinic_security.id('tenant') AND p."UserId" = clinic_security.id('member')),
 EXISTS (SELECT 1 FROM public.user_role_assignments a JOIN public.role_permissions p
 ON p."TenantId" = a."TenantId" AND p."RoleId" = a."RoleId"
 WHERE a."TenantId" = clinic_security.id('tenant') AND a."UserId" = clinic_security.id('member')
 AND p."Permission" = required))
$$;

CREATE FUNCTION clinic_security.branch_access(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
 SELECT clinic_security.value('purpose') = 'branches'
 AND clinic_security.permission('Users.ManageRoles')
 AND EXISTS (SELECT 1 FROM public.tenants a JOIN public.tenants b
 ON coalesce(a."ParentClinicId", a."Id") = coalesce(b."ParentClinicId", b."Id")
 WHERE a."Id" = clinic_security.id('tenant') AND b."Id" = target)
$$;

CREATE FUNCTION clinic_security.provision(target uuid) RETURNS boolean LANGUAGE sql STABLE
SET search_path = pg_catalog AS $$
 SELECT target = clinic_security.id('provision_tenant') AND
 (clinic_security.value('purpose') = 'onboarding' OR clinic_security.platform_admin()
 OR (clinic_security.value('purpose') = 'branches' AND clinic_security.permission('Users.ManageRoles')))
$$;

CREATE FUNCTION clinic_security.new_tenant_parent(parent uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
 SELECT clinic_security.platform_admin() OR
 (clinic_security.value('purpose') = 'onboarding' AND parent IS NULL) OR
 (clinic_security.value('purpose') = 'branches' AND clinic_security.permission('Users.ManageRoles') AND EXISTS (
 SELECT 1 FROM public.tenants t WHERE t."Id" = clinic_security.id('tenant')
 AND coalesce(t."ParentClinicId", t."Id") = parent))
$$;

CREATE FUNCTION clinic_security.backup_access(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
 SELECT clinic_security.value('purpose') = 'backup' AND clinic_security.permission('Backup.Create') AND
 (clinic_security.member_of(target) OR (clinic_security.permission('Users.ManageRoles') AND EXISTS (
 SELECT 1 FROM public.tenants a JOIN public.tenants b
 ON coalesce(a."ParentClinicId", a."Id") = coalesce(b."ParentClinicId", b."Id")
 WHERE a."Id" = clinic_security.id('tenant') AND b."Id" = target)))
$$;

CREATE FUNCTION clinic_security.backup_identity(account uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
 SELECT EXISTS (SELECT 1 FROM public.clinic_users m WHERE m."IdentityUserId" = account
 AND clinic_security.backup_access(m."TenantId"))
$$;

CREATE FUNCTION clinic_security.tenant_access(target uuid) RETURNS boolean LANGUAGE sql STABLE
SET search_path = pg_catalog AS $$
 SELECT clinic_security.member_of(target) OR clinic_security.platform_admin()
 OR clinic_security.branch_access(target) OR clinic_security.provision(target)
$$;

CREATE FUNCTION clinic_security.public_tenant(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
 SELECT clinic_security.value('purpose') = 'booking' AND (EXISTS (
 SELECT 1 FROM public.tenants t JOIN public.tenants c ON c."Id" = coalesce(t."ParentClinicId", t."Id")
 JOIN public.tenant_configurations cfg ON cfg."TenantId" = t."Id"
 WHERE t."Id" = target AND t."Slug" = clinic_security.value('slug')
 AND t."Status" = 1 AND c."Status" = 1 AND cfg."PublicBookingEnabled"
 AND c."SubscriptionStartsAt" <= now() AND c."SubscriptionExpiresAt" > now())
 OR EXISTS (SELECT 1 FROM public.appointments a WHERE a."TenantId" = target
 AND a."PublicManagementTokenHash" = clinic_security.value('management_hash')))
$$;

CREATE FUNCTION clinic_security.booking_access(appointment_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
 SELECT clinic_security.value('purpose') = 'booking' AND EXISTS (
 SELECT 1 FROM public.appointments a WHERE a."Id" = appointment_id AND (
 a."PublicManagementTokenHash" = clinic_security.value('management_hash') OR
 (clinic_security.public_tenant(a."TenantId") AND (a."Id" = clinic_security.id('created_appointment') OR EXISTS (
 SELECT 1 FROM public.public_booking_idempotency_records r WHERE r."TenantId" = a."TenantId"
 AND r."IdempotencyKey" = clinic_security.value('idempotency') AND r."BookingReference" = a."BookingReference")))))
$$;

CREATE FUNCTION clinic_security.parent_metadata(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
 SELECT EXISTS (SELECT 1 FROM public.tenants child WHERE child."ParentClinicId" = target
 AND (clinic_security.member_of(child."Id") OR clinic_security.public_tenant(child."Id")))
$$;

CREATE FUNCTION clinic_security.booking_row_matches(appointment_id uuid, tenant_id uuid, patient_id uuid, doctor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
 SELECT EXISTS (SELECT 1 FROM public.appointments a WHERE a."Id" = appointment_id
 AND a."TenantId" = tenant_id AND a."PatientId" = patient_id AND a."DoctorProfileId" = doctor_id
 AND clinic_security.booking_access(a."Id"))
$$;

CREATE FUNCTION clinic_security.booking_patient(patient_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
 SELECT EXISTS (SELECT 1 FROM public.appointments a WHERE a."PatientId" = patient_id
 AND clinic_security.booking_access(a."Id"))
$$;

-- Public availability returns times only, never appointment/patient rows.
CREATE FUNCTION clinic_security.busy_periods(doctor uuid, range_start timestamptz, range_end timestamptz)
RETURNS TABLE ("StartAt" timestamptz, "EndAt" timestamptz) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
 SELECT a."StartAt", a."EndAt" FROM public.appointments a
 JOIN public.doctor_profiles d ON d."Id" = a."DoctorProfileId" AND d."TenantId" = a."TenantId"
 WHERE d."Id" = doctor AND d."IsPublicBookingEnabled" AND clinic_security.public_tenant(d."TenantId")
 AND a."Status" <> 6 AND a."StartAt" < range_end AND a."EndAt" > range_start
$$;

CREATE FUNCTION clinic_security.hours_tenant(hours uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$ SELECT h."TenantId" FROM public.clinic_hours h WHERE h."Id" = hours $$;

-- Identity bootstrap is a server-only capability around password/token/session verification.
-- It gives no access to patient, clinical or financial tables.
CREATE FUNCTION clinic_security.identity_access() RETURNS boolean LANGUAGE sql STABLE
SET search_path = pg_catalog AS $$ SELECT clinic_security.value('purpose') IN ('identity', 'onboarding') $$;

-- Filled with an explicit, reviewed list below; future tables are NOT automatically granted.
DO $rls$
#variable_conflict use_variable
DECLARE table_name text; tenant_column boolean; base text; read_rule text; write_rule text;
DECLARE identity_tables text[] := ARRAY['AspNetUsers','AspNetRoles','AspNetRoleClaims','AspNetUserClaims','AspNetUserLogins','AspNetUserRoles','AspNetUserTokens','clinic_users','tenant_roles','role_permissions','user_role_assignments','user_permission_profiles','admin_invitations'];
DECLARE public_tables text[] := ARRAY['tenant_configurations','clinic_hours','clinic_holidays','doctor_profiles','doctor_schedules','doctor_schedule_breaks','treatment_catalog_items','notification_templates','notification_preferences'];
DECLARE worker_reads text[] := ARRAY['appointments','patients','tenants','tenant_configurations','clinic_users','user_permission_profiles','user_role_assignments','role_permissions','notification_preferences','notification_templates','notification_deliveries','outbox_messages','in_app_notifications','lab_cases','insurance_claims','inventory_items','platform_health_probes','platform_health_events'];
DECLARE worker_writes text[] := ARRAY['notification_deliveries','outbox_messages','in_app_notifications','communication_activities','platform_health_probes','platform_health_events'];
BEGIN
 FOREACH table_name IN ARRAY ARRAY[
    'admin_invitations',
    'appointments',
    'AspNetRoleClaims',
    'AspNetRoles',
    'AspNetUserClaims',
    'AspNetUserLogins',
    'AspNetUserRoles',
    'AspNetUsers',
    'AspNetUserTokens',
    'booking_inquiries',
    'booking_page_visits',
    'clinic_business_documents',
    'clinic_business_events',
    'clinic_holidays',
    'clinic_hour_periods',
    'clinic_hours',
    'clinic_registrations',
    'clinic_users',
    'communication_activities',
    'dental_finding_surfaces',
    'dental_findings',
    'dental_procedure_surfaces',
    'dental_procedures',
    'doctor_compensation_costs',
    'doctor_compensations',
    'doctor_profiles',
    'doctor_schedule_breaks',
    'doctor_schedules',
    'endodontic_canals',
    'endodontic_records',
    'examinations',
    'expenses',
    'financial_categories',
    'financial_transactions',
    'follow_ups',
    'in_app_notifications',
    'insurance_batches',
    'insurance_claims',
    'insurance_payers',
    'insurance_settlements',
    'inventory_categories',
    'inventory_items',
    'lab_cases',
    'lab_settlements',
    'lab_statements',
    'lab_vendors',
    'medication_catalog_items',
    'notification_deliveries',
    'notification_preferences',
    'notification_templates',
    'outbox_messages',
    'patient_allergies',
    'patient_branch_transfers',
    'patient_insurances',
    'patient_medical_conditions',
    'patient_medications',
    'patient_number_sequences',
    'patient_surgeries',
    'patients',
    'payments',
    'pharmacy_dispensing_items',
    'pharmacy_dispensing_number_sequences',
    'pharmacy_dispensing_reversals',
    'pharmacy_dispensings',
    'platform_audit_logs',
    'platform_emails',
    'platform_health_events',
    'platform_health_probes',
    'platform_mail_settings',
    'prescription_items',
    'prescription_number_sequences',
    'prescriptions',
    'public_booking_idempotency_records',
    'revenues',
    'role_permissions',
    'stock_movements',
    'suppliers',
    'tenant_configurations',
    'tenant_roles',
    'tenants',
    'treatment_catalog_items',
    'treatment_plan_items',
    'treatment_plans',
    'treatment_teeth',
    'treatments',
    'user_permission_profiles',
    'user_preferences',
    'user_role_assignments'
 ] LOOP
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name) THEN
   RAISE EXCEPTION 'Existing policies on % require manual review before this migration', table_name;
  END IF;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND columns.table_name = table_name AND column_name='TenantId') INTO tenant_column;
  base := CASE WHEN tenant_column THEN 'clinic_security.tenant_access("TenantId")' ELSE 'clinic_security.platform_admin()' END;
  read_rule := base; write_rule := base;
  IF tenant_column THEN read_rule := '(' || read_rule || ') OR clinic_security.backup_access("TenantId")'; END IF;

  IF table_name IN ('user_preferences','in_app_notifications') THEN
   read_rule := 'clinic_security.platform_admin() OR clinic_security.backup_access("TenantId") OR (clinic_security.member_of("TenantId") AND "UserId" = clinic_security.id(''member''))';
   write_rule := 'clinic_security.platform_admin() OR (clinic_security.member_of("TenantId") AND "UserId" = clinic_security.id(''member''))';
  END IF;
  IF table_name = ANY(ARRAY['tenant_roles','role_permissions','user_role_assignments','user_permission_profiles']) THEN
   write_rule := '(' || base || ') AND (clinic_security.permission(''Users.ManageRoles'') OR clinic_security.platform_admin() OR clinic_security.provision("TenantId") OR clinic_security.branch_access("TenantId"))';
  END IF;
  IF table_name = ANY(identity_tables) THEN
   read_rule := '(' || read_rule || ') OR clinic_security.identity_access()';
   -- Authentication cannot grant roles. Provisioning needs a scoped new tenant.
   IF table_name LIKE 'AspNet%' THEN
    read_rule := 'clinic_security.platform_admin() OR clinic_security.identity_access()';
    write_rule := read_rule;
    IF table_name = 'AspNetUsers' THEN read_rule := '(' || read_rule || ') OR clinic_security.backup_identity("Id")'; END IF;
   ELSIF table_name IN ('clinic_users','admin_invitations') THEN
    write_rule := '(' || write_rule || ') OR clinic_security.value(''purpose'') = ''identity''';
   END IF;
  END IF;
  IF table_name = ANY(public_tables) THEN
   read_rule := '(' || read_rule || ') OR clinic_security.public_tenant("TenantId")';
  END IF;
  IF table_name IN ('role_permissions','user_role_assignments','user_permission_profiles') THEN
   read_rule := '(' || read_rule || ') OR clinic_security.public_tenant("TenantId")';
  END IF;
  IF table_name = 'clinic_users' THEN
   read_rule := '(' || read_rule || ') OR clinic_security.public_tenant("TenantId")';
   write_rule := '(' || write_rule || ') AND (clinic_security.identity_access() OR clinic_security.platform_admin() OR clinic_security.provision("TenantId") OR clinic_security.branch_access("TenantId") OR clinic_security.permission(''Users.Create'') OR clinic_security.permission(''Users.Edit'') OR clinic_security.permission(''Users.Activate'') OR clinic_security.permission(''Users.Deactivate''))';
  END IF;
  IF table_name = 'tenants' THEN
   read_rule := 'clinic_security.tenant_access("Id") OR clinic_security.backup_access("Id") OR clinic_security.identity_access() OR clinic_security.public_tenant("Id") OR clinic_security.parent_metadata("Id") OR (clinic_security.value(''purpose'') = ''booking'' AND "ShowcaseConsent" AND "ShowcasePublished" AND "Status" = 1 AND "SubscriptionExpiresAt" > now())';
   write_rule := 'clinic_security.platform_admin() OR (clinic_security.provision("Id") AND clinic_security.new_tenant_parent("ParentClinicId")) OR clinic_security.branch_access("Id") OR (clinic_security.member_of("Id") AND clinic_security.permission(''Settings.ClinicProfile''))';
  END IF;
  IF table_name = 'tenant_configurations' THEN
   read_rule := '(' || read_rule || ') OR clinic_security.parent_metadata("TenantId")';
  END IF;
  IF table_name = 'clinic_hour_periods' THEN
   read_rule := 'clinic_security.tenant_access(clinic_security.hours_tenant("ClinicHoursId")) OR clinic_security.public_tenant(clinic_security.hours_tenant("ClinicHoursId"))';
   write_rule := 'clinic_security.tenant_access(clinic_security.hours_tenant("ClinicHoursId"))';
  END IF;
  IF table_name = 'patients' THEN
   read_rule := '(' || read_rule || ') OR (clinic_security.public_tenant("TenantId") AND "Id" = clinic_security.id(''created_patient'')) OR clinic_security.booking_patient("Id")';
  END IF;
  IF table_name = 'appointments' THEN
   read_rule := '(' || read_rule || ') OR clinic_security.booking_access("Id") OR (clinic_security.public_tenant("TenantId") AND "Id" = clinic_security.id(''created_appointment''))';
  END IF;
  IF table_name = 'booking_inquiries' THEN
   read_rule := '(' || read_rule || ') OR (clinic_security.public_tenant("TenantId") AND "Id" = clinic_security.id(''created_inquiry''))';
  END IF;
  IF table_name = 'public_booking_idempotency_records' THEN
   read_rule := '(' || read_rule || ') OR (clinic_security.public_tenant("TenantId") AND "IdempotencyKey" = clinic_security.value(''idempotency''))';
  END IF;
  IF table_name = 'patient_number_sequences' THEN
   read_rule := '(' || read_rule || ') OR clinic_security.public_tenant("TenantId")';
  END IF;
  IF table_name = 'notification_deliveries' THEN
   read_rule := 'clinic_security.platform_admin() OR clinic_security.backup_access("TenantId") OR (clinic_security.member_of("TenantId") AND (clinic_security.permission(''Notifications.View'') OR ("RecipientType" = 3 AND "RecipientId" = clinic_security.id(''member''))))';
   read_rule := '(' || read_rule || ') OR (clinic_security.public_tenant("TenantId") AND (clinic_security.booking_access("RelatedEntityId") OR "RelatedEntityId" = clinic_security.id(''created_inquiry'')))';
  END IF;
  IF table_name = 'outbox_messages' THEN
   read_rule := 'clinic_security.platform_admin() OR clinic_security.backup_access("TenantId") OR (clinic_security.member_of("TenantId") AND clinic_security.permission(''Notifications.Manage''))';
  END IF;
  IF table_name = 'admin_invitations' THEN
   write_rule := 'clinic_security.identity_access() OR clinic_security.platform_admin() OR clinic_security.provision("TenantId") OR (clinic_security.member_of("TenantId") AND clinic_security.permission(''Users.ManageRoles''))';
  END IF;
  IF table_name IN ('clinic_registrations','platform_mail_settings','platform_emails') THEN
   read_rule := 'clinic_security.platform_admin() OR clinic_security.value(''purpose'') = ''onboarding''';
   write_rule := read_rule;
   IF table_name = 'clinic_registrations' THEN
    read_rule := '(' || read_rule || ') OR clinic_security.backup_access("TenantId") OR "IdentityUserId" = clinic_security.id(''identity'') OR (clinic_security.value(''purpose'') = ''booking'' AND "VerifiedAt" IS NOT NULL AND "TenantId" IS NOT NULL)';
   ELSE
    read_rule := '(' || read_rule || ') OR clinic_security.value(''purpose'') = ''mail''';
    IF table_name = 'platform_emails' THEN write_rule := '(' || write_rule || ') OR clinic_security.value(''purpose'') = ''mail'''; END IF;
   END IF;
  END IF;
  IF table_name = ANY(worker_reads) THEN read_rule := '(' || read_rule || ') OR pg_has_role(session_user, ''meddentist_worker'', ''member'')'; END IF;
  IF table_name = ANY(worker_writes) THEN write_rule := '(' || write_rule || ') OR pg_has_role(session_user, ''meddentist_worker'', ''member'')'; END IF;
  IF table_name IN ('platform_health_probes','platform_health_events') THEN
   read_rule := '(' || read_rule || ') OR clinic_security.value(''purpose'') = ''monitoring''';
   write_rule := '(' || write_rule || ') OR clinic_security.value(''purpose'') = ''monitoring''';
  END IF;

  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO meddentist_runtime', table_name);
  EXECUTE format('CREATE POLICY row_read ON public.%I FOR SELECT TO meddentist_runtime USING (%s)', table_name, read_rule);
  EXECUTE format('CREATE POLICY row_insert ON public.%I FOR INSERT TO meddentist_runtime WITH CHECK (%s)', table_name, write_rule);
  EXECUTE format('CREATE POLICY row_update ON public.%I FOR UPDATE TO meddentist_runtime USING (%s) WITH CHECK (%s)', table_name, write_rule, write_rule);
  EXECUTE format('CREATE POLICY row_delete ON public.%I FOR DELETE TO meddentist_runtime USING (%s)', table_name, write_rule);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
 END LOOP;
END $rls$;

-- Separate public creation policies: never grant public deletion or unrestricted updates.
CREATE POLICY public_patient_insert ON public.patients FOR INSERT TO meddentist_runtime
WITH CHECK (clinic_security.public_tenant("TenantId") AND "Id" = clinic_security.id('created_patient') AND "Phone" = clinic_security.value('phone'));
CREATE POLICY public_appointment_insert ON public.appointments FOR INSERT TO meddentist_runtime
WITH CHECK (clinic_security.public_tenant("TenantId") AND "Id" = clinic_security.id('created_appointment') AND "BookingReference" IS NOT NULL);
CREATE POLICY public_appointment_update ON public.appointments FOR UPDATE TO meddentist_runtime
USING (clinic_security.booking_access("Id"))
WITH CHECK (clinic_security.booking_row_matches("Id", "TenantId", "PatientId", "DoctorProfileId"));
CREATE POLICY public_inquiry_insert ON public.booking_inquiries FOR INSERT TO meddentist_runtime
WITH CHECK (clinic_security.public_tenant("TenantId") AND "Id" = clinic_security.id('created_inquiry'));
CREATE POLICY public_visit_insert ON public.booking_page_visits FOR INSERT TO meddentist_runtime
WITH CHECK (clinic_security.public_tenant("TenantId"));
CREATE POLICY public_idempotency_insert ON public.public_booking_idempotency_records FOR INSERT TO meddentist_runtime
WITH CHECK (clinic_security.public_tenant("TenantId") AND "IdempotencyKey" = clinic_security.value('idempotency'));

CREATE POLICY public_sequence_insert ON public.patient_number_sequences FOR INSERT TO meddentist_runtime
WITH CHECK (clinic_security.public_tenant("TenantId"));
CREATE POLICY public_sequence_update ON public.patient_number_sequences FOR UPDATE TO meddentist_runtime
USING (clinic_security.public_tenant("TenantId")) WITH CHECK (clinic_security.public_tenant("TenantId"));
CREATE POLICY public_delivery_insert ON public.notification_deliveries FOR INSERT TO meddentist_runtime
WITH CHECK (clinic_security.public_tenant("TenantId") AND (clinic_security.booking_access("RelatedEntityId") OR "RelatedEntityId" = clinic_security.id('created_inquiry')));
CREATE POLICY public_outbox_insert ON public.outbox_messages FOR INSERT TO meddentist_runtime
WITH CHECK (clinic_security.public_tenant("TenantId"));

-- Changing these links would let a profile editor impersonate another member,
-- or move a whole clinic under somebody else's clinic group.
CREATE FUNCTION clinic_security.guard_identity_links() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN
 IF pg_has_role(session_user, 'meddentist_runtime', 'member') AND NOT clinic_security.platform_admin() THEN
  IF TG_TABLE_NAME = 'tenants' THEN
   IF OLD."ParentClinicId" IS DISTINCT FROM NEW."ParentClinicId" THEN
    RAISE EXCEPTION 'Clinic ownership cannot be changed' USING ERRCODE = '42501';
   END IF;
  ELSIF OLD."IdentityUserId" IS DISTINCT FROM NEW."IdentityUserId" THEN
   RAISE EXCEPTION 'Membership identity cannot be changed' USING ERRCODE = '42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_clinic_parent BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION clinic_security.guard_identity_links();
CREATE TRIGGER protect_membership_identity BEFORE UPDATE ON public.clinic_users
FOR EACH ROW EXECUTE FUNCTION clinic_security.guard_identity_links();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA clinic_security FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA clinic_security TO meddentist_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO meddentist_runtime;
GRANT SELECT ON public."__EFMigrationsHistory" TO meddentist_runtime;
