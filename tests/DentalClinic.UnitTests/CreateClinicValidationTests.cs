using DentalClinic.Application;
using DentalClinic.Application.Tenants;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.UnitTests;

public sealed class CreateClinicValidationTests
{
    [Theory]
    [InlineData("-pearl", "Slug")]
    [InlineData("pearl--dental", "Slug")]
    [InlineData("pearl-dental", "AdminPassword")]
    public async Task RejectsInvalidClinicCodeOrInitialPassword(string slug, string expectedProperty)
    {
        var services = new ServiceCollection();
        services.AddApplication();
        await using var provider = services.BuildServiceProvider();
        var validator = provider.GetRequiredService<IValidator<CreateClinicCommand>>();
        var command = new CreateClinicCommand("Pearl Dental", slug, "+201000000000", "info@pearl.test",
            "Cairo", "Cairo", "Egypt", "Africa/Cairo", "EGP", "owner@pearl.test", null,
            1, slug == "pearl-dental" ? "short" : null);

        var result = await validator.ValidateAsync(command);

        Assert.Contains(result.Errors, error => error.PropertyName == expectedProperty);
    }
}
