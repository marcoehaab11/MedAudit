using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Dental;

public sealed class Examination : TenantOwnedEntity
{
    private readonly List<DentalFinding> findings = [];
    private readonly List<DentalProcedure> procedures = [];
    private readonly List<EndodonticRecord> endodonticRecords = [];
    private Examination() { }

    public Examination(Guid tenantId, Guid patientId, Guid appointmentId, Guid doctorUserId,
        Guid createdBy, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || patientId == Guid.Empty || appointmentId == Guid.Empty ||
            doctorUserId == Guid.Empty || createdBy == Guid.Empty)
            throw new ArgumentException("Tenant, patient, appointment, doctor, and creator IDs are required.");
        TenantId = tenantId; PatientId = patientId; AppointmentId = appointmentId;
        DoctorUserId = doctorUserId; CreatedBy = createdBy; Status = ExaminationStatus.Draft;
        CreatedAt = createdAt; UpdatedAt = createdAt; Version = Guid.NewGuid();
    }

    public Guid PatientId { get; private set; }
    public Guid AppointmentId { get; private set; }
    public Guid DoctorUserId { get; private set; }
    public Guid CreatedBy { get; private set; }
    public ExaminationStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public Guid Version { get; private set; }
    public IReadOnlyCollection<DentalFinding> Findings => findings;
    public IReadOnlyCollection<DentalProcedure> Procedures => procedures;
    public IReadOnlyCollection<EndodonticRecord> EndodonticRecords => endodonticRecords;

    public void UpdateNotes(string? notes, Guid expectedVersion, DateTimeOffset now)
    { EnsureEditable(expectedVersion); Notes = DentalText.Optional(notes, nameof(notes), 4000); Touch(now); }

    public DentalFinding AddFinding(int toothNumber, DentalFindingType type, IEnumerable<ToothSurface> surfaces,
        string? notes, Guid actorId, Guid expectedVersion, DateTimeOffset now)
    { EnsureEditable(expectedVersion); var item = new DentalFinding(TenantId, Id, PatientId, toothNumber, type, surfaces, notes, actorId, now); findings.Add(item); Touch(now); return item; }
    public void UpdateFinding(Guid id, DentalFindingType type, IEnumerable<ToothSurface> surfaces,
        string? notes, Guid expectedVersion, DateTimeOffset now)
    { EnsureEditable(expectedVersion); Find(findings, id).Update(type, surfaces, notes, now); Touch(now); }
    public void RemoveFinding(Guid id, Guid expectedVersion, DateTimeOffset now)
    { EnsureEditable(expectedVersion); findings.Remove(Find(findings, id)); Touch(now); }

    public DentalProcedure AddProcedure(int toothNumber, DentalProcedureType type, IEnumerable<ToothSurface> surfaces,
        string? notes, Guid actorId, Guid expectedVersion, DateTimeOffset now)
    { EnsureEditable(expectedVersion); var item = new DentalProcedure(TenantId, Id, PatientId, toothNumber, type, surfaces, notes, actorId, now); procedures.Add(item); Touch(now); return item; }
    public void UpdateProcedure(Guid id, DentalProcedureType type, IEnumerable<ToothSurface> surfaces,
        string? notes, Guid expectedVersion, DateTimeOffset now)
    { EnsureEditable(expectedVersion); Find(procedures, id).Update(type, surfaces, notes, now); Touch(now); }
    public void RemoveProcedure(Guid id, Guid expectedVersion, DateTimeOffset now)
    { EnsureEditable(expectedVersion); procedures.Remove(Find(procedures, id)); Touch(now); }

    public EndodonticRecord AddEndodonticRecord(int toothNumber, string? notes, IEnumerable<EndodonticCanalInput> canals,
        Guid actorId, Guid expectedVersion, DateTimeOffset now)
    { EnsureEditable(expectedVersion); var item = new EndodonticRecord(TenantId, Id, PatientId, toothNumber, notes, canals, actorId, now); endodonticRecords.Add(item); Touch(now); return item; }
    public void UpdateEndodonticRecord(Guid id, string? notes, IEnumerable<EndodonticCanalInput> canals,
        Guid expectedVersion, DateTimeOffset now)
    { EnsureEditable(expectedVersion); Find(endodonticRecords, id).Update(notes, canals, now); Touch(now); }
    public void RemoveEndodonticRecord(Guid id, Guid expectedVersion, DateTimeOffset now)
    { EnsureEditable(expectedVersion); endodonticRecords.Remove(Find(endodonticRecords, id)); Touch(now); }

    public void Complete(Guid expectedVersion, DateTimeOffset now)
    { EnsureEditable(expectedVersion); Status = ExaminationStatus.Completed; CompletedAt = now; Touch(now); }

    private void EnsureEditable(Guid expectedVersion)
    {
        if (Status == ExaminationStatus.Completed) throw new DentalStateException("Completed examinations are immutable.");
        if (expectedVersion == Guid.Empty || expectedVersion != Version)
            throw new DentalConcurrencyException("The examination changed. Reload it before continuing.");
    }
    private void Touch(DateTimeOffset now) { UpdatedAt = now; Version = Guid.NewGuid(); }
    private static T Find<T>(IEnumerable<T> items, Guid id) where T : Entity =>
        items.SingleOrDefault(x => x.Id == id) ?? throw new KeyNotFoundException("Clinical record was not found.");
}

public sealed class DentalConcurrencyException(string message) : Exception(message);
public sealed class DentalStateException(string message) : Exception(message);
