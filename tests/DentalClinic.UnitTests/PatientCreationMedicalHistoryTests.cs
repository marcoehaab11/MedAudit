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
    private static ServiceProvider Services(IPatientStore store) => new ServiceCollection().AddApplication().AddSingleton(store)
        .AddSingleton<IPermissionService>(new CreateOnly()).AddSingleton<ICurrentTenant>(new Tenant())
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
