using System.Reflection;
using DentalClinic.Application;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Patients;
using DentalClinic.Domain.Patients;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.UnitTests;

public sealed class PatientCreationMedicalHistoryTests
{
    [Fact]
    public async Task CreationStoresMedicalWarningsWithThePatientUsingCreatePermissionOnly()
    {
        var store = DispatchProxy.Create<IPatientStore, StoreSpy>();
        using var services = Services(store);
        var id = await services.GetRequiredService<IPatientCommands>().CreateAsync(new(Profile(), ["Penicillin", " penicillin "], ["Diabetes"], ["Metformin"]), CancellationToken.None);
        var spy = (StoreSpy)store;
        Assert.Equal(id, Assert.Single(spy.Patients).Id);
        Assert.Equal("Penicillin", Assert.Single(spy.Allergies).Name);
        Assert.Equal("Diabetes", Assert.Single(spy.Conditions).Name);
        Assert.Equal("Metformin", Assert.Single(spy.Medications).Name);
        Assert.Equal(id, spy.Allergies[0].PatientId);
        Assert.Equal(1, spy.SaveCount); Assert.True(spy.Transaction.Committed);
    }
    [Fact]
    public async Task InvalidMedicalHistoryDoesNotSaveAnIncompletePatient()
    {
        var store = DispatchProxy.Create<IPatientStore, StoreSpy>();
        using var services = Services(store);
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() => services.GetRequiredService<IPatientCommands>().CreateAsync(new(Profile(), [new string('x', 201)]), CancellationToken.None));
        Assert.Equal(0, ((StoreSpy)store).SaveCount);
        Assert.False(((StoreSpy)store).Transaction.Committed);
    }
    private static PatientProfileInput Profile() => new("Mona", null, "Hassan", PatientGender.Female, new(1990, 1, 1), "01012345678", null, null, null, null, null, null, null, null, null, null, null);
    [Fact]
    public async Task EditingProfileSavesMedicalChangesWithoutReplacingUnchangedRecordDetails()
    {
        var store = DispatchProxy.Create<IPatientStore, StoreSpy>();
        using var services = Services(store, new AllowAll());
        var commands = services.GetRequiredService<IPatientCommands>();
        var id = await commands.CreateAsync(new(Profile(), ["Latex"], ["Diabetes"], ["Metformin"]), CancellationToken.None);
        var spy = (StoreSpy)store;
        var original = Assert.Single(spy.Allergies);
        await commands.UpdateAsync(new(id, Profile(), ["latex", "Penicillin"], [], ["Metformin"]), CancellationToken.None);
        Assert.Contains(spy.Allergies, x => x.Id == original.Id);
        Assert.Equal(2, spy.Allergies.Count); Assert.Empty(spy.Conditions);
        var details = await services.GetRequiredService<IPatientQueries>().GetAsync(id, CancellationToken.None);
        Assert.Equal(2, details!.Allergies.Count); Assert.Empty(details.MedicalConditions);
        Assert.Equal("Metformin", Assert.Single(details.Medications).Name);
        Assert.Equal(2, spy.SaveCount);
    }

    [Fact]
    public async Task ProfileEditCannotBypassMedicalHistoryPermissions()
    {
        var store = DispatchProxy.Create<IPatientStore, StoreSpy>();
        using var services = Services(store, new ProfileOnly());
        await Assert.ThrowsAsync<InvalidOperationException>(() => services.GetRequiredService<IPatientCommands>().UpdateAsync(new(Guid.NewGuid(), Profile(), ["Latex"]), CancellationToken.None));
        Assert.Equal(0, ((StoreSpy)store).SaveCount);
    }

    private sealed class ProfileOnly : IPermissionService {
        public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(permission == Permissions.PatientsEdit);
        public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => permission == Permissions.PatientsEdit ? Task.CompletedTask : throw new InvalidOperationException("Medical permission required");
    }

    private sealed class AllowAll : IPermissionService {
        public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(true);
        public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => Task.CompletedTask;
    }
    private static ServiceProvider Services(IPatientStore store, IPermissionService? permissions = null) => new ServiceCollection().AddApplication().AddSingleton(store)
        .AddSingleton<IPermissionService>(permissions ?? new CreateOnly()).AddSingleton<ICurrentTenant>(new Tenant())
        .AddSingleton<ICurrentUser>(new Actor()).AddSingleton<ISystemClock>(new Clock()).BuildServiceProvider();
    private sealed class CreateOnly : IPermissionService {
        public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(permission == Permissions.PatientsCreate);
        public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => permission == Permissions.PatientsCreate ? Task.CompletedTask : throw new InvalidOperationException("Unexpected extra permission");
    }
    private sealed class Tenant : ICurrentTenant { public Guid? TenantId => Guid.Parse("22222222-2222-2222-2222-222222222222"); public bool IsAvailable => true; public Guid RequireTenantId() => TenantId!.Value; }
    private sealed class Actor : ICurrentUser { public Guid? UserId => Guid.Parse("11111111-1111-1111-1111-111111111111"); }
    private sealed class Clock : ISystemClock { public DateTimeOffset UtcNow => new(2026, 10, 16, 12, 0, 0, TimeSpan.Zero); }
    public sealed class TransactionSpy : IPatientTransaction {
        public bool Committed { get; private set; }
        public Task CommitAsync(CancellationToken cancellationToken) { Committed = true; return Task.CompletedTask; }
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
    public class StoreSpy : DispatchProxy {
        public List<Patient> Patients { get; } = [];
        public List<PatientAllergy> Allergies { get; } = [];
        public List<PatientMedicalCondition> Conditions { get; } = [];
        public List<PatientMedication> Medications { get; } = [];
        public TransactionSpy Transaction { get; } = new();
        public int SaveCount { get; private set; }
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) {
            switch (targetMethod?.Name) {
                case nameof(IPatientStore.FindPatientAsync): return Task.FromResult(Patients.FirstOrDefault(x => x.Id == (Guid)args![0]!));
                case nameof(IPatientStore.GetDetailsAsync): {
                    var patient = Patients.Single(); var p = Profile(); var now = new Clock().UtcNow;
                    return Task.FromResult<PatientDetails?>(new(patient.Id, patient.PatientNumber, p.FirstName, p.MiddleName, p.LastName, p.Gender, p.DateOfBirth, p.Phone, p.AlternatePhone, p.Email, p.Address, p.City, p.Country, p.EmergencyContactName, p.EmergencyContactPhone, p.Nationality, p.Occupation, p.MaritalStatus, p.Notes, null, PatientStatus.Active, now, now, true, true,
                        Allergies.Select(x => new MedicalTextItem(x.Id, x.Name, x.Notes, now, now)).ToArray(), Conditions.Select(x => new MedicalTextItem(x.Id, x.Name, x.Notes, now, now)).ToArray(), Medications.Select(x => new MedicationItem(x.Id, x.Name, x.Dosage, x.Notes, now, now)).ToArray(), []));
                }
                case nameof(IPatientStore.FindConditionAsync): return Task.FromResult(Conditions.FirstOrDefault(x => x.Id == (Guid)args![1]!));
                case nameof(IPatientStore.RemoveCondition): Conditions.Remove((PatientMedicalCondition)args![0]!); return null;
                case nameof(IPatientStore.BeginTransactionAsync): return Task.FromResult<IPatientTransaction>(Transaction);
                case nameof(IPatientStore.ReservePatientNumberAsync): return Task.FromResult("P-000001");
                case nameof(IPatientStore.AddPatient): Patients.Add((Patient)args![0]!); return null;
                case nameof(IPatientStore.AddAllergy): Allergies.Add((PatientAllergy)args![0]!); return null;
                case nameof(IPatientStore.AddCondition): Conditions.Add((PatientMedicalCondition)args![0]!); return null;
                case nameof(IPatientStore.AddMedication): Medications.Add((PatientMedication)args![0]!); return null;
                case nameof(IPatientStore.AddAudit): return null;
                case nameof(IPatientStore.SaveChangesAsync): SaveCount++; return Task.CompletedTask;
                default: throw new NotSupportedException(targetMethod?.Name);
            }
        }
    }
}
