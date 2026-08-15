using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Prescriptions;

namespace DentalClinic.Application.Prescriptions;

internal sealed class MedicationCatalogService(IPrescriptionStore store, IPermissionService permissions,
    ICurrentTenant tenant, ICurrentUser user, ISystemClock clock) : IMedicationCatalogService
{
    public async Task<PagedResult<MedicationCatalogDetails>> SearchAsync(MedicationSearch search, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.PrescriptionsView, token); Validate(search.Page, search.PageSize); return await store.SearchMedicationsAsync(search, token); }
    public async Task<Guid> CreateAsync(MedicationCatalogInput input, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.SettingsEdit, token); var item = new MedicationCatalogItem(tenant.RequireTenantId(), input.Name, input.GenericName, input.Strength, input.Form, input.Notes, clock.UtcNow); store.AddMedication(item); Audit(PlatformAuditAction.MedicationCatalogCreated, item.Id); await store.SaveChangesAsync(token); return item.Id; }
    public async Task<bool> UpdateAsync(Guid id, MedicationCatalogInput input, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.SettingsEdit, token); var item = await store.FindMedicationAsync(id, true, token); if (item is null) return false; item.Update(input.Name, input.GenericName, input.Strength, input.Form, input.Notes, input.IsActive, clock.UtcNow); Audit(PlatformAuditAction.MedicationCatalogUpdated, id); await store.SaveChangesAsync(token); return true; }
    private void Audit(PlatformAuditAction action, Guid id) => store.AddAudit(new(tenant.RequireTenantId(), user.UserId, action, "MedicationCatalogItem", id, clock.UtcNow, null));
    private static void Validate(int page, int size) { if (page < 1 || size is < 1 or > 100) throw new ArgumentOutOfRangeException(nameof(page)); }
}

internal sealed class PrescriptionService(IPrescriptionStore store, PrescriptionAccess access, IPermissionService permissions,
    IPrescriptionDocumentService documents, IPrescriptionQrCodeService qrCodes, IPrescriptionReferenceGenerator references,
    ICurrentTenant tenant, ICurrentUser user, ISystemClock clock) : IPrescriptionService
{
    public async Task<PagedResult<PrescriptionListItem>> SearchAsync(PrescriptionSearch search, CancellationToken token)
    { ValidateSearch(search); return await store.SearchPrescriptionsAsync(search, await access.VisibleDoctorAsync(Permissions.PrescriptionsView, token), token); }
    public async Task<PrescriptionDetails?> GetAsync(Guid id, CancellationToken token) =>
        await store.GetPrescriptionAsync(id, await access.VisibleDoctorAsync(Permissions.PrescriptionsView, token), token);
    public async Task<Guid> CreateAsync(CreatePrescriptionCommand command, CancellationToken token)
    {
        await access.EnsureDoctorAsync(command.DoctorProfileId, Permissions.PrescriptionsCreate, token); await ValidateAssociationsAsync(command.PatientId, command.DoctorProfileId, command.AppointmentId, command.ExaminationId, command.TreatmentId, token);
        await using var transaction = await store.BeginTransactionAsync(token); var number = await store.ReserveNumberAsync(tenant.RequireTenantId(), token);
        var prescription = new Prescription(tenant.RequireTenantId(), command.PatientId, command.DoctorProfileId, command.AppointmentId,
            command.ExaminationId, command.TreatmentId, number, command.Notes, user.UserId ?? throw new UnauthorizedAccessException(), clock.UtcNow);
        foreach (var item in command.Items.OrderBy(x => x.SortOrder)) await AddItemCoreAsync(prescription, item, token);
        store.AddPrescription(prescription); Audit(PlatformAuditAction.PrescriptionCreated, prescription.Id); await store.SaveChangesAsync(token); await transaction.CommitAsync(token); return prescription.Id;
    }
    public async Task<bool> UpdateAsync(UpdatePrescriptionCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.PrescriptionsEdit, token); var item = await store.FindPrescriptionAsync(command.Id, true, token); if (item is null) return false;
        await access.EnsureDoctorAsync(item.DoctorProfileId, Permissions.PrescriptionsEdit, token); await access.EnsureDoctorAsync(command.DoctorProfileId, Permissions.PrescriptionsEdit, token);
        await ValidateAssociationsAsync(command.PatientId, command.DoctorProfileId, command.AppointmentId, command.ExaminationId, command.TreatmentId, token);
        item.UpdateContext(command.PatientId, command.DoctorProfileId, command.AppointmentId, command.ExaminationId, command.TreatmentId, command.Notes, command.Version, clock.UtcNow);
        Audit(PlatformAuditAction.PrescriptionUpdated, item.Id); await store.SaveChangesAsync(token); return true;
    }
    public async Task<bool> AddItemAsync(Guid id, PrescriptionItemInput input, Guid version, CancellationToken token)
    { var item = await FindForEditAsync(id, token); if (item is null) return false; if (item.Version != version) throw new PrescriptionConcurrencyException("The prescription changed. Reload it before continuing."); var added = await AddItemCoreAsync(item, input, token); Audit(PlatformAuditAction.PrescriptionUpdated, added.Id); await store.SaveChangesAsync(token); return true; }
    public async Task<bool> UpdateItemAsync(UpdatePrescriptionItemCommand command, CancellationToken token)
    { var item = await FindForEditAsync(command.PrescriptionId, token); if (item is null) return false; item.UpdateItem(command.ItemId, command.Dose, command.Frequency, command.Duration, command.Route, command.Instructions, command.Quantity, command.SortOrder, command.Version, clock.UtcNow); Audit(PlatformAuditAction.PrescriptionUpdated, command.ItemId); await store.SaveChangesAsync(token); return true; }
    public async Task<bool> RemoveItemAsync(Guid id, Guid itemId, Guid version, CancellationToken token)
    { var item = await FindForEditAsync(id, token); if (item is null) return false; item.RemoveItem(itemId, version, clock.UtcNow); Audit(PlatformAuditAction.PrescriptionUpdated, itemId); await store.SaveChangesAsync(token); return true; }
    public async Task<bool> IssueAsync(Guid id, Guid version, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.PrescriptionsIssue, token); var item = await store.FindPrescriptionAsync(id, true, token); if (item is null) return false; await access.EnsureDoctorAsync(item.DoctorProfileId, Permissions.PrescriptionsIssue, token); item.Issue(user.UserId ?? throw new UnauthorizedAccessException(), references.Generate(), version, clock.UtcNow); Audit(PlatformAuditAction.PrescriptionIssued, id); await store.SaveChangesAsync(token); return true; }
    public async Task<bool> CancelAsync(Guid id, Guid version, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.PrescriptionsCancel, token); var item = await store.FindPrescriptionAsync(id, true, token); if (item is null) return false; await access.EnsureDoctorAsync(item.DoctorProfileId, Permissions.PrescriptionsCancel, token); item.Cancel(version, clock.UtcNow); Audit(PlatformAuditAction.PrescriptionCancelled, id); await store.SaveChangesAsync(token); return true; }
    public async Task<PrescriptionDocument?> DownloadAsync(Guid id, bool print, CancellationToken token)
    {
        var permission = print ? Permissions.PrescriptionsPrint : Permissions.PrescriptionsDownload; var visible = await access.VisibleDoctorAsync(permission, token);
        var details = await store.GetPrescriptionAsync(id, visible, token); if (details is null) return null; if (!details.IssuedAt.HasValue || details.DocumentReference is null) throw new PrescriptionStateException("Only issued prescriptions have documents.");
        var doctor = await store.FindDoctorAsync(details.DoctorProfileId, token) ?? throw new PrescriptionNotFoundException("Prescription is not available."); var clinic = await store.GetClinicAsync(token);
        var model = new PrescriptionDocumentModel(clinic, details.PrescriptionNumber, details.PatientName, details.DoctorName, doctor.Specialization, doctor.LicenseNumber,
            details.IssuedAt.Value, details.Notes, $"/prescriptions/verify/{details.DocumentReference}", details.Items);
        var document = await documents.GenerateAsync(model, token); Audit(print ? PlatformAuditAction.PrescriptionPrinted : PlatformAuditAction.PrescriptionDownloaded, id); await store.SaveChangesAsync(token); return document;
    }
    public async Task<string?> GetQrSvgAsync(Guid id, CancellationToken token)
    { var details = await store.GetPrescriptionAsync(id, await access.VisibleDoctorAsync(Permissions.PrescriptionsView, token), token); return details?.DocumentReference is { } reference ? qrCodes.GenerateSvg($"/prescriptions/verify/{reference}") : null; }
    private async Task<Prescription?> FindForEditAsync(Guid id, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.PrescriptionsEdit, token); var item = await store.FindPrescriptionAsync(id, true, token); if (item is not null) await access.EnsureDoctorAsync(item.DoctorProfileId, Permissions.PrescriptionsEdit, token); return item; }
    private async Task<PrescriptionItem> AddItemCoreAsync(Prescription prescription, PrescriptionItemInput input, CancellationToken token)
    {
        MedicationCatalogItem? medication = null; if (input.MedicationId.HasValue) medication = await store.FindMedicationAsync(input.MedicationId.Value, false, token);
        if (input.MedicationId.HasValue && (medication is null || !medication.IsActive)) throw new PrescriptionNotFoundException("An active medication is required.");
        return prescription.AddItem(medication?.Id, medication?.Name ?? input.MedicationName ?? string.Empty, medication?.GenericName ?? input.GenericName,
            medication?.Strength ?? input.Strength, medication?.Form ?? input.Form, input.Dose, input.Frequency, input.Duration, input.Route,
            input.Instructions, input.Quantity, input.SortOrder, prescription.Version, clock.UtcNow);
    }
    private async Task ValidateAssociationsAsync(Guid patientId, Guid doctorId, Guid? appointmentId, Guid? examinationId, Guid? treatmentId, CancellationToken token)
    {
        var patient = await store.FindPatientAsync(patientId, token); var doctor = await store.FindDoctorAsync(doctorId, token);
        if (patient is null || !patient.IsActive || doctor is null || !doctor.IsActive) throw new PrescriptionNotFoundException("An active patient and doctor are required.");
        var appointment = appointmentId.HasValue ? await store.FindAppointmentAsync(appointmentId.Value, token) : null;
        var examination = examinationId.HasValue ? await store.FindExaminationAsync(examinationId.Value, token) : null;
        var treatment = treatmentId.HasValue ? await store.FindTreatmentAsync(treatmentId.Value, token) : null;
        if ((appointmentId.HasValue && appointment is null) || (examinationId.HasValue && examination is null) || (treatmentId.HasValue && treatment is null))
            throw new PrescriptionNotFoundException("Clinical association is not available.");
        foreach (var association in new[] { appointment, examination, treatment }.Where(x => x is not null))
            if (association!.PatientId != patientId || association.DoctorProfileId != doctorId) throw new ArgumentException("Clinical association does not match the prescription patient and doctor.");
    }
    private void Audit(PlatformAuditAction action, Guid id) => store.AddAudit(new(tenant.RequireTenantId(), user.UserId, action, "Prescription", id, clock.UtcNow, null));
    private static void ValidateSearch(PrescriptionSearch x) { if (x.Page < 1 || x.PageSize is < 1 or > 100 || x.From > x.To) throw new ArgumentException("Invalid prescription search."); }
}
