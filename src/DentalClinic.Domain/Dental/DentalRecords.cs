using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Dental;

public sealed class DentalFinding : TenantOwnedEntity
{
    private readonly List<DentalFindingSurface> surfaces = [];
    private DentalFinding() { }

    internal DentalFinding(Guid tenantId, Guid examinationId, Guid patientId, int toothNumber,
        DentalFindingType type, IEnumerable<ToothSurface> selectedSurfaces, string? notes,
        Guid createdBy, DateTimeOffset createdAt)
    {
        TenantId = tenantId; ExaminationId = examinationId; PatientId = patientId;
        ToothNumber = PermanentToothCatalog.Get(toothNumber).Number;
        ToothId = PermanentToothCatalog.Get(toothNumber).Id;
        Apply(type, selectedSurfaces, notes);
        CreatedBy = createdBy; CreatedAt = createdAt; UpdatedAt = createdAt;
    }

    public Guid ExaminationId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid ToothId { get; private set; }
    public int ToothNumber { get; private set; }
    public DentalFindingType FindingType { get; private set; }
    public string? Notes { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public IReadOnlyCollection<DentalFindingSurface> Surfaces => surfaces;

    internal void Update(DentalFindingType type, IEnumerable<ToothSurface> selectedSurfaces,
        string? notes, DateTimeOffset updatedAt)
    { Apply(type, selectedSurfaces, notes); UpdatedAt = updatedAt; }

    private void Apply(DentalFindingType type, IEnumerable<ToothSurface> selectedSurfaces, string? notes)
    {
        if (!Enum.IsDefined(type)) throw new ArgumentOutOfRangeException(nameof(type));
        FindingType = type; Notes = DentalText.Optional(notes, nameof(notes), 2000);
        surfaces.Clear();
        foreach (var surface in DentalRules.ValidateSurfaces(selectedSurfaces))
            surfaces.Add(new DentalFindingSurface(TenantId, Id, surface));
    }
}

public sealed class DentalFindingSurface : TenantOwnedEntity
{
    private DentalFindingSurface() { }
    internal DentalFindingSurface(Guid tenantId, Guid findingId, ToothSurface surface)
    { TenantId = tenantId; FindingId = findingId; Surface = surface; }
    public Guid FindingId { get; private set; }
    public ToothSurface Surface { get; private set; }
}

public sealed class DentalProcedure : TenantOwnedEntity
{
    private readonly List<DentalProcedureSurface> surfaces = [];
    private DentalProcedure() { }
    internal DentalProcedure(Guid tenantId, Guid examinationId, Guid patientId, int toothNumber,
        DentalProcedureType type, IEnumerable<ToothSurface> selectedSurfaces, string? notes,
        Guid createdBy, DateTimeOffset createdAt)
    {
        TenantId = tenantId; ExaminationId = examinationId; PatientId = patientId;
        ToothNumber = PermanentToothCatalog.Get(toothNumber).Number;
        ToothId = PermanentToothCatalog.Get(toothNumber).Id;
        Apply(type, selectedSurfaces, notes);
        CreatedBy = createdBy; CreatedAt = createdAt; UpdatedAt = createdAt;
    }
    public Guid ExaminationId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid ToothId { get; private set; }
    public int ToothNumber { get; private set; }
    public DentalProcedureType ProcedureType { get; private set; }
    public string? Notes { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public IReadOnlyCollection<DentalProcedureSurface> Surfaces => surfaces;
    internal void Update(DentalProcedureType type, IEnumerable<ToothSurface> selectedSurfaces,
        string? notes, DateTimeOffset updatedAt)
    { Apply(type, selectedSurfaces, notes); UpdatedAt = updatedAt; }
    private void Apply(DentalProcedureType type, IEnumerable<ToothSurface> selectedSurfaces, string? notes)
    {
        if (!Enum.IsDefined(type)) throw new ArgumentOutOfRangeException(nameof(type));
        ProcedureType = type; Notes = DentalText.Optional(notes, nameof(notes), 2000);
        surfaces.Clear();
        foreach (var surface in DentalRules.ValidateSurfaces(selectedSurfaces))
            surfaces.Add(new DentalProcedureSurface(TenantId, Id, surface));
    }
}

public sealed class DentalProcedureSurface : TenantOwnedEntity
{
    private DentalProcedureSurface() { }
    internal DentalProcedureSurface(Guid tenantId, Guid procedureId, ToothSurface surface)
    { TenantId = tenantId; ProcedureId = procedureId; Surface = surface; }
    public Guid ProcedureId { get; private set; }
    public ToothSurface Surface { get; private set; }
}

public sealed class EndodonticRecord : TenantOwnedEntity
{
    private readonly List<EndodonticCanal> canals = [];
    private EndodonticRecord() { }
    internal EndodonticRecord(Guid tenantId, Guid examinationId, Guid patientId, int toothNumber,
        string? notes, IEnumerable<EndodonticCanalInput> canalInputs, Guid createdBy, DateTimeOffset createdAt)
    {
        TenantId = tenantId; ExaminationId = examinationId; PatientId = patientId;
        ToothNumber = PermanentToothCatalog.Get(toothNumber).Number;
        ToothId = PermanentToothCatalog.Get(toothNumber).Id;
        CreatedBy = createdBy; CreatedAt = createdAt; Apply(notes, canalInputs, createdAt);
    }
    public Guid ExaminationId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid ToothId { get; private set; }
    public int ToothNumber { get; private set; }
    public string? Notes { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public IReadOnlyCollection<EndodonticCanal> Canals => canals;
    internal void Update(string? notes, IEnumerable<EndodonticCanalInput> canalInputs, DateTimeOffset updatedAt) =>
        Apply(notes, canalInputs, updatedAt);
    private void Apply(string? notes, IEnumerable<EndodonticCanalInput> canalInputs, DateTimeOffset updatedAt)
    {
        Notes = DentalText.Optional(notes, nameof(notes), 2000);
        var inputs = canalInputs?.ToArray() ?? throw new ArgumentNullException(nameof(canalInputs));
        if (inputs.Length == 0) throw new ArgumentException("At least one canal is required.", nameof(canalInputs));
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        canals.Clear();
        foreach (var input in inputs)
        {
            var name = DentalText.Required(input.Name, nameof(input.Name), 50);
            if (!names.Add(name)) throw new ArgumentException("Canal names must be unique within a record.", nameof(canalInputs));
            canals.Add(new EndodonticCanal(TenantId, Id, name, input.LengthMm, input.Notes));
        }
        UpdatedAt = updatedAt;
    }
}

public sealed record EndodonticCanalInput(string Name, decimal LengthMm, string? Notes);

public sealed class EndodonticCanal : TenantOwnedEntity
{
    private EndodonticCanal() { }
    internal EndodonticCanal(Guid tenantId, Guid endodonticRecordId, string name, decimal lengthMm, string? notes)
    {
        if (lengthMm is <= 0 or > 50) throw new ArgumentOutOfRangeException(nameof(lengthMm), "Canal length must be between 0 and 50 mm.");
        TenantId = tenantId; EndodonticRecordId = endodonticRecordId;
        Name = DentalText.Required(name, nameof(name), 50); LengthMm = lengthMm;
        Notes = DentalText.Optional(notes, nameof(notes), 1000);
    }
    public Guid EndodonticRecordId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public decimal LengthMm { get; private set; }
    public string? Notes { get; private set; }
}

internal static class DentalRules
{
    public static IReadOnlyCollection<ToothSurface> ValidateSurfaces(IEnumerable<ToothSurface>? values)
    {
        var surfaces = values?.Distinct().ToArray() ?? [];
        if (surfaces.Any(x => !Enum.IsDefined(x))) throw new ArgumentOutOfRangeException(nameof(values));
        if (surfaces.Contains(ToothSurface.WholeTooth) && surfaces.Length > 1)
            throw new ArgumentException("Whole tooth cannot be combined with individual surfaces.", nameof(values));
        return surfaces;
    }
}

internal static class DentalText
{
    public static string Required(string value, string parameter, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("Value is required.", parameter);
        var result = value.Trim();
        return result.Length <= max ? result : throw new ArgumentException($"Value cannot exceed {max} characters.", parameter);
    }
    public static string? Optional(string? value, string parameter, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : Required(value, parameter, max);
}
