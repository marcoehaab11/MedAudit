using System.Reflection;
using DentalClinic.Application;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Finance;
using DentalClinic.Application.Dental;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Treatments;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Treatments;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.UnitTests;

public sealed class TreatmentExplicitPriceTests
{
    [Theory]
    [InlineData(400)]
    [InlineData(0)]
    public async Task ExplicitWholeMouthPriceIsNotMultipliedByTheToothCount(int price)
    {
        var store = DispatchProxy.Create<ITreatmentStore, StoreSpy>();
        using var services = Services(store);
        await services.GetRequiredService<ITreatmentService>().CreateAsync(new(Guid.NewGuid(), Guid.NewGuid(), ((StoreSpy)store).Catalog.Id, null, null, null, PermanentToothCatalog.All.Select(t => t.Number).ToArray(), "Whole mouth", price), CancellationToken.None);
        var treatment = Assert.Single(((StoreSpy)store).Added);
        Assert.Equal((decimal)price, treatment.Price); Assert.Equal(32, treatment.Teeth.Count);
    }
    [Fact]
    public async Task NegativeCustomPriceIsRejectedBeforeCreatingTreatment()
    {
        var store = DispatchProxy.Create<ITreatmentStore, StoreSpy>();
        using var services = Services(store);
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => services.GetRequiredService<ITreatmentService>().CreateAsync(new(Guid.NewGuid(), Guid.NewGuid(), ((StoreSpy)store).Catalog.Id, null, null, null, [36], null, -1), CancellationToken.None));
        Assert.Empty(((StoreSpy)store).Added);
    }
    private static ServiceProvider Services(ITreatmentStore store) => new ServiceCollection().AddApplication().AddSingleton(store)
        .AddSingleton<IPermissionService>(new AllowPermissions()).AddSingleton<ICurrentTenant>(new Tenant())
        .AddSingleton<ICurrentUser>(new Actor()).AddSingleton<ISystemClock>(new Clock())
        .AddSingleton<ITreatmentRevenueCreator>(new NoRevenue())
        .AddSingleton(DispatchProxy.Create<IDentalStore, UnusedDentalStore>())
        .AddSingleton(DispatchProxy.Create<IFinanceStore, UnusedDentalStore>()).BuildServiceProvider();
    private sealed class AllowPermissions : IPermissionService
    {
        public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(true);
        public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => Task.CompletedTask;
    }
    private sealed class Tenant : ICurrentTenant { public Guid? TenantId => Guid.Parse("22222222-2222-2222-2222-222222222222"); public bool IsAvailable => true; public Guid RequireTenantId() => TenantId!.Value; }
    private sealed class Actor : ICurrentUser { public Guid? UserId => Guid.Parse("11111111-1111-1111-1111-111111111111"); }
    private sealed class Clock : ISystemClock { public DateTimeOffset UtcNow => new(2026, 10, 16, 12, 0, 0, TimeSpan.Zero); }
    private sealed class NoRevenue : ITreatmentRevenueCreator
    {
        public Task EnsureForCompletedTreatmentAsync(Guid treatmentId, CancellationToken token) => Task.CompletedTask;
        public Task EnsureForTreatmentPlanAsync(Guid planId, CancellationToken token) => Task.CompletedTask;
    }
    public class UnusedDentalStore : DispatchProxy
    {
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) => throw new NotSupportedException(targetMethod?.Name);
    }
    public class StoreSpy : DispatchProxy
    {
        public TreatmentCatalogItem Catalog { get; } = new(new Tenant().RequireTenantId(), TreatmentType.Other, "Scaling and polishing", "SP", null, 400, DateTimeOffset.UtcNow);
        public List<Treatment> Added { get; } = [];
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            switch (targetMethod?.Name)
            {
                case nameof(ITreatmentStore.FindPatientAsync): return Task.FromResult<TreatmentPatient?>(new((Guid)args![0]!, "Mona", true));
                case nameof(ITreatmentStore.FindDoctorAsync): return Task.FromResult<TreatmentDoctor?>(new((Guid)args![0]!, new Actor().UserId!.Value, "Doctor", true));
                case nameof(ITreatmentStore.FindCatalogAsync): return Task.FromResult<TreatmentCatalogItem?>(Catalog);
                case nameof(ITreatmentStore.AddTreatment): Added.Add((Treatment)args![0]!); return null;
                case nameof(ITreatmentStore.AddAudit): return null;
                case nameof(ITreatmentStore.SaveChangesAsync): return Task.CompletedTask;
                default: throw new NotSupportedException(targetMethod?.Name);
            }
        }
    }
}
