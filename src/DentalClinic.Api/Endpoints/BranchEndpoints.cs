using System.Text.RegularExpressions;
using System.Text.Json;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Patients;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Api.Endpoints;

internal static class BranchEndpoints
{
    private static readonly JsonSerializerOptions SnapshotJsonOptions = new(JsonSerializerDefaults.Web);
    private sealed record CreateBranchRequest(string Name, string Code, string Phone, string Address, string City, string Country);
    private sealed record SetBranchStatusRequest(bool Active);
    private sealed record UpdateClinicThemeRequest(string PrimaryColor, string SecondaryColor, string AccentColor);
    private sealed record BranchSummary(Guid Id, string Name, string Slug, string Phone, string Address,
        string City, string Country, bool Active, bool HasAccess, bool IsMain);
    private sealed record BranchTotals(Guid Id, string Name, int Patients, int Appointments,
        decimal Revenue, decimal Payments, decimal Expenses);

    public static IEndpointRouteBuilder MapBranchEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var branches = endpoints.MapGroup("/api/branches").RequireAuthorization(AuthConstants.TenantMemberPolicy)
            .AddEndpointFilter(new DatabaseAccessFilter("branches"));
        branches.MapGet("/", ListAsync);
        branches.MapGet("/summary", SummaryAsync);
        branches.MapGet("/theme", GetThemeAsync);
        branches.MapPut("/theme", UpdateThemeAsync);
        branches.MapPost("/", CreateAsync);
        branches.MapPut("/{branchId:guid}/status", SetStatusAsync);
        branches.MapPost("/{targetBranchId:guid}/staff/{sourceUserId:guid}/transfer", TransferStaffAsync);
        branches.MapPost("/{targetBranchId:guid}/patients/{sourcePatientId:guid}/transfer", TransferPatientAsync)
            .RequireAuthorization(Permissions.PatientsEdit, Permissions.PatientsViewMedicalHistory);
        branches.MapGet("/patients/{targetPatientId:guid}/transfer-history", GetTransferHistoryAsync)
            .RequireAuthorization(Permissions.PatientsViewMedicalHistory);
        return endpoints;
    }

    private static async Task<IResult> GetThemeAsync(ApplicationDbContext db, ICurrentTenant currentTenant,
        ICurrentUser currentUser, CancellationToken token)
    {
        var tenantId = currentTenant.RequireTenantId();
        var tenant = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == tenantId, token);
        var clinicId = tenant.ParentClinicId ?? tenant.Id;
        var config = await db.TenantConfigurations.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(x => x.TenantId == clinicId, token);
        return Results.Ok(new
        {
            primaryColor = config?.PrimaryColor ?? "#087b68",
            secondaryColor = config?.SecondaryColor ?? "#0d9488",
            accentColor = config?.AccentColor ?? "#f59e0b",
            canManage = await IsClinicAdminAsync(db, tenantId, currentUser.UserId!.Value, token)
        });
    }

    private static async Task<IResult> UpdateThemeAsync(UpdateClinicThemeRequest request,
        ApplicationDbContext db, IPlatformClinicStore store, ICurrentTenant currentTenant,
        ICurrentUser currentUser, CancellationToken token)
    {
        var tenantId = currentTenant.RequireTenantId();
        if (!await IsClinicAdminAsync(db, tenantId, currentUser.UserId!.Value, token)) return Results.Forbid();
        var tenant = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == tenantId, token);
        var clinicId = tenant.ParentClinicId ?? tenant.Id;
        var config = await db.TenantConfigurations.IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.TenantId == clinicId, token);
        if (config is null) return Results.NotFound();
        try
        {
            config.UpdateBranding(request.PrimaryColor, request.SecondaryColor, request.AccentColor,
                config.DefaultLanguage, config.SupportedLanguages, config.RtlEnabled, config.Version);
        }
        catch (ArgumentException error)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["colors"] = [error.Message] });
        }
        store.AddAudit(new PlatformAuditLog(clinicId, null, PlatformAuditAction.SettingsBrandingUpdated,
            nameof(TenantConfiguration), config.Id, DateTimeOffset.UtcNow, null));
        await store.SavePlatformChangesAsync(clinicId, token);
        return Results.Ok(new { config.PrimaryColor, config.SecondaryColor, config.AccentColor, canManage = true });
    }

    private static async Task<IResult> ListAsync(ApplicationDbContext db, ICurrentTenant currentTenant,
        ICurrentUser currentUser, CancellationToken token)
    {
        var tenantId = currentTenant.RequireTenantId();
        var current = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == tenantId, token);
        var clinicId = current.ParentClinicId ?? current.Id;
        var isAdmin = await IsClinicAdminAsync(db, tenantId, currentUser.UserId!.Value, token);
        var identityId = await db.ClinicUsers.AsNoTracking().Where(x => x.Id == currentUser.UserId.Value)
            .Select(x => x.IdentityUserId).SingleAsync(token);
        var items = await db.Tenants.AsNoTracking()
            .Where(x => x.Id == clinicId || x.ParentClinicId == clinicId)
            .OrderBy(x => x.ParentClinicId != null).ThenBy(x => x.Name)
            .Select(x => new BranchSummary(x.Id, x.Name, x.Slug, x.Phone, x.Address, x.City, x.Country,
                x.Status == TenantStatus.Active,
                db.ClinicUsers.IgnoreQueryFilters().Any(user => user.TenantId == x.Id &&
                    user.IdentityUserId == identityId && user.Status == UserStatus.Active), x.Id == clinicId))
            .ToListAsync(token);
        return Results.Ok(new { branches = isAdmin ? items : items.Where(x => x.HasAccess), canManage = isAdmin });
    }

    private static async Task<IResult> SummaryAsync(ApplicationDbContext db, ICurrentTenant currentTenant,
        ICurrentUser currentUser, CancellationToken token)
    {
        var tenantId = currentTenant.RequireTenantId();
        if (!await IsClinicAdminAsync(db, tenantId, currentUser.UserId!.Value, token)) return Results.Forbid();
        var selected = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == tenantId, token);
        var clinicId = selected.ParentClinicId ?? selected.Id;
        var branches = await db.Tenants.AsNoTracking().Where(x => x.Id == clinicId || x.ParentClinicId == clinicId)
            .OrderBy(x => x.Name).Select(x => new { x.Id, x.Name }).ToArrayAsync(token);
        var rows = new List<BranchTotals>();
        foreach (var branch in branches)
            rows.Add(new BranchTotals(branch.Id, branch.Name,
                await db.Patients.IgnoreQueryFilters().CountAsync(x => x.TenantId == branch.Id, token),
                await db.Appointments.IgnoreQueryFilters().CountAsync(x => x.TenantId == branch.Id, token),
                await db.Revenues.IgnoreQueryFilters().Where(x => x.TenantId == branch.Id)
                    .SumAsync(x => (decimal?)x.Amount, token) ?? 0,
                await db.Payments.IgnoreQueryFilters().Where(x => x.TenantId == branch.Id)
                    .SumAsync(x => (decimal?)x.Amount, token) ?? 0,
                await db.Expenses.IgnoreQueryFilters().Where(x => x.TenantId == branch.Id)
                    .SumAsync(x => (decimal?)x.Amount, token) ?? 0));
        return Results.Ok(new
        {
            branches = rows,
            totals = new
            {
                patients = rows.Sum(x => x.Patients),
                appointments = rows.Sum(x => x.Appointments),
                revenue = rows.Sum(x => x.Revenue),
                payments = rows.Sum(x => x.Payments),
                expenses = rows.Sum(x => x.Expenses)
            }
        });
    }

    private static async Task<IResult> CreateAsync(CreateBranchRequest request, ApplicationDbContext db,
        IPlatformClinicStore store, IEnumerable<ITenantInitializer> initializers,
        ICurrentTenant currentTenant, ICurrentUser currentUser, CancellationToken token)
    {
        var tenantId = currentTenant.RequireTenantId();
        var userId = currentUser.UserId!.Value;
        if (!await IsClinicAdminAsync(db, tenantId, userId, token)) return Results.Forbid();
        var code = request.Code?.Trim().ToLowerInvariant() ?? "";
        if (!Regex.IsMatch(code, "^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.CultureInvariant) || code.Length > 30)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["code"] = ["Use lowercase letters, numbers and single hyphens."] });
        var selected = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == tenantId, token);
        var clinic = selected.ParentClinicId is Guid parentId
            ? await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == parentId, token)
            : selected;
        var slug = $"{clinic.Slug}-{code}";
        if (slug.Length > 100 || await db.Tenants.AnyAsync(x => x.Slug == slug, token))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["code"] = ["This branch code is unavailable."] });
        var owner = await db.ClinicUsers.AsNoTracking().SingleAsync(x => x.Id == userId, token);
        var now = DateTimeOffset.UtcNow;
        Tenant branch;
        try
        {
            branch = new Tenant(request.Name, slug, request.Phone, clinic.Email, request.Address,
                request.City, request.Country, clinic.TimeZone, clinic.Currency, now, clinic.LogoReference);
            branch.AttachToClinic(clinic.Id);
        }
        catch (ArgumentException error)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["branch"] = [error.Message] });
        }

        await using var transaction = await store.BeginTransactionAsync(token);
        store.AddTenant(branch);
        await store.SavePlatformChangesAsync(branch.Id, token);
        foreach (var initializer in initializers) await initializer.InitializeAsync(branch, token);
        await store.SavePlatformChangesAsync(branch.Id, token);
        var adminRole = await store.FindRoleByNameAsync(branch.Id, SystemRoleDefinitions.ClinicAdmin.ToUpperInvariant(), token);
        if (adminRole is null) throw new InvalidOperationException("Branch administrator role was not initialized.");
        var membershipId = Guid.NewGuid();
        store.AddClinicUser(new ClinicUser(membershipId, branch.Id, owner.DisplayName, owner.Phone,
            UserStatus.Active, now, owner.IdentityUserId));
        store.AddUserRole(new UserRoleAssignment(branch.Id, membershipId, adminRole.Id, now));
        store.AddAudit(new PlatformAuditLog(branch.Id, membershipId, PlatformAuditAction.BranchCreated,
            nameof(Tenant), branch.Id, now, null));
        await store.SavePlatformChangesAsync(branch.Id, token);
        await transaction.CommitAsync(token);
        return Results.Created($"/api/branches/{branch.Id:D}", new { branch.Id, branch.Name, branch.Slug });
    }

    private static async Task<IResult> SetStatusAsync(Guid branchId, SetBranchStatusRequest request,
        ApplicationDbContext db, ICurrentTenant currentTenant, ICurrentUser currentUser, CancellationToken token)
    {
        var tenantId = currentTenant.RequireTenantId();
        if (!await IsClinicAdminAsync(db, tenantId, currentUser.UserId!.Value, token)) return Results.Forbid();
        var selected = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == tenantId, token);
        var clinicId = selected.ParentClinicId ?? selected.Id;
        if (!request.Active && branchId == tenantId)
            return Results.BadRequest(new { message = "Open another branch before pausing this one." });
        var branch = await db.Tenants.SingleOrDefaultAsync(x => x.Id == branchId && x.ParentClinicId == clinicId, token);
        if (branch is null) return Results.NotFound();
        if (request.Active) branch.Activate(DateTimeOffset.UtcNow);
        else branch.Deactivate(DateTimeOffset.UtcNow);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<IResult> TransferStaffAsync(Guid targetBranchId, Guid sourceUserId,
        ApplicationDbContext db, IPlatformClinicStore store, ICurrentTenant currentTenant,
        ICurrentUser currentUser, CancellationToken token)
    {
        var sourceTenantId = currentTenant.RequireTenantId();
        var actorId = currentUser.UserId!.Value;
        if (!await IsClinicAdminAsync(db, sourceTenantId, actorId, token)) return Results.Forbid();
        if (sourceUserId == actorId) return Results.BadRequest(new { message = "The current administrator cannot transfer their own account." });
        var source = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == sourceTenantId, token);
        var clinicId = source.ParentClinicId ?? source.Id;
        var target = await db.Tenants.AsNoTracking().SingleOrDefaultAsync(x => x.Id == targetBranchId &&
            (x.Id == clinicId || x.ParentClinicId == clinicId) && x.Status == TenantStatus.Active, token);
        if (target is null || target.Id == sourceTenantId) return Results.BadRequest(new { message = "Choose another active branch in this clinic." });
        var member = await db.ClinicUsers.SingleOrDefaultAsync(x => x.Id == sourceUserId && x.Status == UserStatus.Active, token);
        if (member is null) return Results.NotFound();
        var targetMember = await db.ClinicUsers.IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.TenantId == target.Id && x.IdentityUserId == member.IdentityUserId, token);
        if (targetMember?.Status is UserStatus.Active or UserStatus.Invited)
            return Results.Conflict(new { message = "This staff account already belongs to the target branch." });

        var sourceRoles = await (from assignment in db.UserRoleAssignments.AsNoTracking()
                                 join role in db.TenantRoles.AsNoTracking() on assignment.RoleId equals role.Id
                                 where assignment.UserId == member.Id
                                 select role.NormalizedName).ToArrayAsync(token);
        if (sourceRoles.Contains("CLINICADMIN", StringComparer.Ordinal))
            return Results.BadRequest(new { message = "Clinic administrators must retain access to their branch." });
        var targetRoles = await db.TenantRoles.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == target.Id && sourceRoles.Contains(x.NormalizedName))
            .ToArrayAsync(token);
        if (targetRoles.Length != sourceRoles.Length)
            return Results.Conflict(new { message = "A required custom role does not exist in the target branch." });
        var profile = await db.UserPermissionProfiles.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == member.Id, token);
        var sourceDoctor = await db.DoctorProfiles.AsNoTracking()
            .SingleOrDefaultAsync(x => x.ClinicUserId == member.Id, token);
        if (sourceDoctor is not null && await db.Appointments.AsNoTracking().AnyAsync(x =>
                x.DoctorProfileId == sourceDoctor.Id &&
                ((x.StartAt >= DateTimeOffset.UtcNow &&
                  (x.Status == AppointmentStatus.Scheduled || x.Status == AppointmentStatus.Confirmed)) ||
                 x.Status == AppointmentStatus.CheckedIn || x.Status == AppointmentStatus.InProgress), token))
            return Results.Conflict(new { message = "Reschedule or cancel this doctor's upcoming appointments before transferring the account." });
        var existingTargetDoctor = targetMember is null ? null : await db.DoctorProfiles.IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.TenantId == target.Id && x.ClinicUserId == targetMember.Id, token);
        if (sourceDoctor?.LicenseNumber is string license && existingTargetDoctor is null &&
            await db.DoctorProfiles.IgnoreQueryFilters().AnyAsync(x => x.TenantId == target.Id && x.LicenseNumber == license, token))
            return Results.Conflict(new { message = "The doctor's license number is already used in the target branch." });
        var sourceSchedules = sourceDoctor is null ? Array.Empty<DoctorSchedule>() : await db.DoctorSchedules.AsNoTracking()
            .Include(x => x.Breaks).Where(x => x.DoctorProfileId == sourceDoctor.Id).ToArrayAsync(token);
        var now = DateTimeOffset.UtcNow;
        await using var transaction = await store.BeginTransactionAsync(token);
        member.Deactivate(now);
        db.PlatformAuditLogs.Add(new PlatformAuditLog(sourceTenantId, actorId, PlatformAuditAction.StaffTransferred,
            nameof(ClinicUser), member.Id, now, null));
        await db.SaveChangesAsync(token);

        var transferredId = targetMember?.Id ?? Guid.NewGuid();
        var currentRoleIds = new HashSet<Guid>();
        if (targetMember is null)
            store.AddClinicUser(new ClinicUser(transferredId, target.Id, member.DisplayName, member.Phone,
                UserStatus.Active, now, member.IdentityUserId));
        else
        {
            targetMember.Update(member.DisplayName, member.Phone, now);
            targetMember.Activate(now);
            var oldAssignments = await db.UserRoleAssignments.IgnoreQueryFilters()
                .Where(x => x.TenantId == target.Id && x.UserId == transferredId).ToArrayAsync(token);
            var targetRoleIds = targetRoles.Select(x => x.Id).ToHashSet();
            db.UserRoleAssignments.RemoveRange(oldAssignments.Where(x => !targetRoleIds.Contains(x.RoleId)));
            currentRoleIds.UnionWith(oldAssignments.Select(x => x.RoleId));
        }
        foreach (var role in targetRoles.Where(x => !currentRoleIds.Contains(x.Id)))
            store.AddUserRole(new UserRoleAssignment(target.Id, transferredId, role.Id, now));
        var targetProfile = await db.UserPermissionProfiles.IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.TenantId == target.Id && x.UserId == transferredId, token);
        if (profile is not null && targetProfile is null)
            db.UserPermissionProfiles.Add(new UserPermissionProfile(target.Id, transferredId, profile.Permissions));
        else if (profile is not null) targetProfile!.SetPermissions(profile.Permissions);
        else if (targetProfile is not null) db.UserPermissionProfiles.Remove(targetProfile);
        if (sourceDoctor is not null && existingTargetDoctor is null)
        {
            var doctor = new DoctorProfile(target.Id, transferredId, sourceDoctor.Specialization,
                sourceDoctor.LicenseNumber, sourceDoctor.Bio, sourceDoctor.ConsultationDurationMinutes, now,
                sourceDoctor.IsPublicBookingEnabled);
            db.DoctorProfiles.Add(doctor);
            foreach (var schedule in sourceSchedules)
                db.DoctorSchedules.Add(new DoctorSchedule(target.Id, doctor.Id, schedule.DayOfWeek,
                    schedule.StartTime, schedule.EndTime, schedule.SlotDurationMinutes,
                    schedule.Breaks.Select(x => (x.StartTime, x.EndTime)).ToArray(), now));
        }
        store.AddAudit(new PlatformAuditLog(target.Id, transferredId, PlatformAuditAction.StaffTransferred,
            nameof(ClinicUser), transferredId, now, null));
        await store.SavePlatformChangesAsync(target.Id, token);
        await transaction.CommitAsync(token);
        return Results.Ok(new { sourceUserId, targetUserId = transferredId, targetBranchId });
    }

    private static async Task<IResult> TransferPatientAsync(Guid targetBranchId, Guid sourcePatientId,
        ApplicationDbContext db, IPatientStore patientStore, IPlatformClinicStore store,
        ICurrentTenant currentTenant, ICurrentUser currentUser, CancellationToken token)
    {
        var sourceTenantId = currentTenant.RequireTenantId();
        var actorId = currentUser.UserId!.Value;
        if (!await IsClinicAdminAsync(db, sourceTenantId, actorId, token)) return Results.Forbid();
        var sourceBranch = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == sourceTenantId, token);
        var clinicId = sourceBranch.ParentClinicId ?? sourceBranch.Id;
        var target = await db.Tenants.AsNoTracking().SingleOrDefaultAsync(x => x.Id == targetBranchId &&
            (x.Id == clinicId || x.ParentClinicId == clinicId) && x.Status == TenantStatus.Active, token);
        if (target is null || target.Id == sourceTenantId)
            return Results.BadRequest(new { message = "Choose another active branch in this clinic." });
        var source = await db.Patients.SingleOrDefaultAsync(x => x.Id == sourcePatientId && x.Status == PatientStatus.Active, token);
        if (source is null) return Results.NotFound();
        if (await db.Appointments.AsNoTracking().AnyAsync(x => x.PatientId == source.Id &&
                ((x.StartAt >= DateTimeOffset.UtcNow &&
                  (x.Status == AppointmentStatus.Scheduled || x.Status == AppointmentStatus.Confirmed)) ||
                 x.Status == AppointmentStatus.CheckedIn || x.Status == AppointmentStatus.InProgress), token))
            return Results.Conflict(new { message = "Reschedule or cancel the patient's upcoming appointments before transferring the file." });

        var allergies = await db.PatientAllergies.AsNoTracking().Where(x => x.PatientId == source.Id).ToArrayAsync(token);
        var conditions = await db.PatientMedicalConditions.AsNoTracking().Where(x => x.PatientId == source.Id).ToArrayAsync(token);
        var medications = await db.PatientMedications.AsNoTracking().Where(x => x.PatientId == source.Id).ToArrayAsync(token);
        var surgeries = await db.PatientSurgeries.AsNoTracking().Where(x => x.PatientId == source.Id).ToArrayAsync(token);
        var previousTransfer = await db.PatientBranchTransfers.AsNoTracking()
            .Where(x => x.TargetPatientId == source.Id).Select(x => x.ClinicalSnapshotJson).SingleOrDefaultAsync(token);
        var snapshot = JsonSerializer.Serialize(new
        {
            sourceBranch = sourceBranch.Name,
            sourcePatientNumber = source.PatientNumber,
            source.MedicalNotes,
            allergies,
            conditions,
            medications,
            surgeries,
            appointments = await db.Appointments.AsNoTracking().Where(x => x.PatientId == source.Id).ToArrayAsync(token),
            examinations = await db.Examinations.AsNoTracking().Where(x => x.PatientId == source.Id).ToArrayAsync(token),
            findings = await db.DentalFindings.AsNoTracking().Where(x => x.PatientId == source.Id).ToArrayAsync(token),
            procedures = await db.DentalProcedures.AsNoTracking().Where(x => x.PatientId == source.Id).ToArrayAsync(token),
            endodonticRecords = await db.EndodonticRecords.AsNoTracking().Where(x => x.PatientId == source.Id).ToArrayAsync(token),
            treatmentPlans = await db.TreatmentPlans.AsNoTracking().Where(x => x.PatientId == source.Id).ToArrayAsync(token),
            treatments = await db.Treatments.AsNoTracking().Where(x => x.PatientId == source.Id).ToArrayAsync(token),
            prescriptions = await db.Prescriptions.AsNoTracking().Where(x => x.PatientId == source.Id).ToArrayAsync(token),
            previousHistory = previousTransfer is null ? (JsonElement?)null : JsonSerializer.Deserialize<JsonElement>(previousTransfer)
        }, SnapshotJsonOptions);

        await using var transaction = await store.BeginTransactionAsync(token);
        var now = DateTimeOffset.UtcNow;
        var targetNumber = await patientStore.ReservePatientNumberAsync(target.Id, token);
        source.Archive(now);
        db.PlatformAuditLogs.Add(new PlatformAuditLog(sourceTenantId, actorId, PlatformAuditAction.PatientTransferred,
            nameof(Patient), source.Id, now, null));
        await db.SaveChangesAsync(token);

        var next = new Patient(target.Id, targetNumber, source.FirstName, source.MiddleName, source.LastName,
            source.Gender, source.DateOfBirth, source.Phone, source.AlternatePhone, source.Email, source.Address,
            source.City, source.Country, source.EmergencyContactName, source.EmergencyContactPhone,
            source.Nationality, source.Occupation, source.MaritalStatus, source.Notes, source.MedicalNotes, now);
        db.Patients.Add(next);
        foreach (var item in allergies) db.PatientAllergies.Add(new PatientAllergy(target.Id, next.Id, item.Name, item.Notes, now));
        foreach (var item in conditions) db.PatientMedicalConditions.Add(new PatientMedicalCondition(target.Id, next.Id, item.Name, item.Notes, now));
        foreach (var item in medications) db.PatientMedications.Add(new PatientMedication(target.Id, next.Id, item.Name, item.Dosage, item.Notes, now));
        foreach (var item in surgeries) db.PatientSurgeries.Add(new PatientSurgery(target.Id, next.Id, item.Procedure, item.ProcedureDate, item.Notes, now));
        db.PatientBranchTransfers.Add(new PatientBranchTransfer(target.Id, sourceTenantId, source.Id,
            next.Id, actorId, snapshot, now));
        store.AddAudit(new PlatformAuditLog(target.Id, null, PlatformAuditAction.PatientTransferred,
            nameof(Patient), next.Id, now, null));
        await store.SavePlatformChangesAsync(target.Id, token);
        await transaction.CommitAsync(token);
        return Results.Ok(new { sourcePatientId, targetPatientId = next.Id, targetPatientNumber = next.PatientNumber, targetBranchId });
    }

    private static async Task<IResult> GetTransferHistoryAsync(Guid targetPatientId, ApplicationDbContext db,
        ICurrentTenant currentTenant, CancellationToken token)
    {
        var tenantId = currentTenant.RequireTenantId();
        var history = await db.PatientBranchTransfers.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.TargetPatientId == targetPatientId)
            .Select(x => x.ClinicalSnapshotJson).SingleOrDefaultAsync(token);
        return history is null ? Results.NotFound() : Results.Content(history, "application/json");
    }

    private static Task<bool> IsClinicAdminAsync(ApplicationDbContext db, Guid tenantId, Guid userId, CancellationToken token) =>
        (from assignment in db.UserRoleAssignments.IgnoreQueryFilters().AsNoTracking()
         join role in db.TenantRoles.IgnoreQueryFilters().AsNoTracking() on new { assignment.TenantId, assignment.RoleId }
             equals new { role.TenantId, RoleId = role.Id }
         where assignment.TenantId == tenantId && assignment.UserId == userId &&
               role.NormalizedName == "CLINICADMIN"
         select assignment.Id).AnyAsync(token);
}
