using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Domain.Common;
using DentalClinic.Infrastructure.Persistence;
using NetArchTest.Rules;

namespace DentalClinic.ArchitectureTests;

public sealed class DependencyRulesTests
{
    [Fact]
    public void DomainHasNoOutwardDependencies()
    {
        var result = Types.InAssembly(typeof(Entity).Assembly)
            .ShouldNot()
            .HaveDependencyOnAny(
                "DentalClinic.Application",
                "DentalClinic.Infrastructure",
                "Microsoft.EntityFrameworkCore",
                "Microsoft.AspNetCore")
            .GetResult();

        Assert.True(result.IsSuccessful, FormatFailures(result));
    }

    [Fact]
    public void ApplicationDoesNotDependOnInfrastructureOrHosts()
    {
        var result = Types.InAssembly(typeof(ICurrentTenant).Assembly)
            .ShouldNot()
            .HaveDependencyOnAny(
                "DentalClinic.Infrastructure",
                "DentalClinic.Api",
                "DentalClinic.PlatformAdmin")
            .GetResult();

        Assert.True(result.IsSuccessful, FormatFailures(result));
    }

    [Fact]
    public void InfrastructureDoesNotDependOnApiHost()
    {
        var result = Types.InAssembly(typeof(ApplicationDbContext).Assembly)
            .ShouldNot()
            .HaveDependencyOn("DentalClinic.Api")
            .GetResult();

        Assert.True(result.IsSuccessful, FormatFailures(result));
    }

    private static string FormatFailures(TestResult result) =>
        result.FailingTypes is null
            ? "Architecture rule failed."
            : string.Join(", ", result.FailingTypes.Select(x => x.FullName));
}
