using System.Reflection;
using DentalClinic.Application;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Dental;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Platform;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.UnitTests;

public sealed class RootCanalAuthorizationTests
{
    private static readonly Guid ActorId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly DateTimeOffset Now = new(2026, 10, 17, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task InvalidPatientToothDoctorOrProcedureLinkCannotBeSaved()
    {
        var store = DispatchProxy.Create<IDentalStore, Store>(); var spy = (Store)store;
        using var services = Services(store);
        await Assert.ThrowsAsync<DentalStateException>(() => services.GetRequiredService<IExaminationCommands>().AddEndodonticAsync(spy.Examination.Id, new(26, null, [new("MB", null, null)], RootCanalStage.AccessOpening, Guid.NewGuid()), spy.Examination.Version, CancellationToken.None));
        Assert.Empty(spy.Examination.EndodonticRecords); Assert.False(spy.Saved);
    }

    [Fact]
    public async Task ValidLinkStoresClinicalProgressAndAuditsWithoutInvokingBilling()
    {
        var store = DispatchProxy.Create<IDentalStore, Store>(); var spy = (Store)store; spy.LinkMatches = true;
        using var services = Services(store); var treatmentId = Guid.NewGuid();
        await services.GetRequiredService<IExaminationCommands>().AddEndodonticAsync(spy.Examination.Id, new(26, "Continue next visit", [new("MB", 21m, null, "25/.06")], RootCanalStage.CleaningAndShaping, treatmentId), spy.Examination.Version, CancellationToken.None);
        var record = Assert.Single(spy.Examination.EndodonticRecords);
        Assert.Equal(treatmentId, record.TreatmentId); Assert.Equal(RootCanalStage.CleaningAndShaping, record.Stage);
        Assert.True(spy.Saved); Assert.Equal(PlatformAuditAction.EndodonticRecordCreated, Assert.Single(spy.Audits).Action);
    }

    [Fact]
    public async Task UpdatingAnotherToothRecordIsRejected()
    {
        var store = DispatchProxy.Create<IDentalStore, Store>(); var spy = (Store)store; spy.LinkMatches = true;
        var treatmentId = Guid.NewGuid();
        var record = spy.Examination.AddEndodonticRecord(26, null, [new("MB", 21m, null)], ActorId, spy.Examination.Version, Now, RootCanalStage.WorkingLength, treatmentId);
        using var services = Services(store);
        await Assert.ThrowsAsync<DentalStateException>(() => services.GetRequiredService<IExaminationCommands>().UpdateEndodonticAsync(spy.Examination.Id, record.Id, new(27, null, [new("MB", 22m, null)], RootCanalStage.Obturation, treatmentId), spy.Examination.Version, CancellationToken.None));
        Assert.Equal(21m, Assert.Single(record.Canals).LengthMm); Assert.False(spy.Saved);
    }

    private static ServiceProvider Services(IDentalStore store) => new ServiceCollection().AddApplication().AddSingleton(store)
        .AddSingleton<IPermissionService>(new PermissionsStub()).AddSingleton<ICurrentTenant>(new Tenant()).AddSingleton<ICurrentUser>(new Actor()).AddSingleton<ISystemClock>(new Clock()).BuildServiceProvider();
    private sealed class PermissionsStub : IPermissionService {
        public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(false);
        public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => permission is Permissions.DentalEdit or Permissions.ExaminationEdit ? Task.CompletedTask : throw new InvalidOperationException("Unexpected permission");
    }
    private sealed class Tenant : ICurrentTenant { public Guid? TenantId => Guid.Parse("22222222-2222-2222-2222-222222222222"); public bool IsAvailable => true; public Guid RequireTenantId() => TenantId!.Value; }
    private sealed class Actor : ICurrentUser { public Guid? UserId => ActorId; }
    private sealed class Clock : ISystemClock { public DateTimeOffset UtcNow => Now; }
    public class Store : DispatchProxy {
        public Examination Examination { get; } = new(Guid.Parse("22222222-2222-2222-2222-222222222222"), Guid.NewGuid(), Guid.NewGuid(), ActorId, ActorId, Now);
        public bool LinkMatches { get; set; }
        public bool Saved { get; private set; }
        public List<PlatformAuditLog> Audits { get; } = [];
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) => targetMethod?.Name switch {
            nameof(IDentalStore.FindExaminationAsync) => Task.FromResult<Examination?>(Examination),
            nameof(IDentalStore.IsRootCanalTreatmentAsync) => Task.FromResult(LinkMatches),
            nameof(IDentalStore.AddAudit) => Audit((PlatformAuditLog)args![0]!),
            nameof(IDentalStore.SaveChangesAsync) => Save(),
            _ => throw new NotSupportedException(targetMethod?.Name),
        };
        private object? Audit(PlatformAuditLog audit) { Audits.Add(audit); return null; }
        private Task Save() { Saved = true; return Task.CompletedTask; }
    }
}
