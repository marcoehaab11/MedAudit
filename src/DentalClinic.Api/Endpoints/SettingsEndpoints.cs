using DentalClinic.Application.Tenants;

namespace DentalClinic.Api.Endpoints;

public static class SettingsEndpoints
{
    public static IEndpointRouteBuilder MapSettingsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/settings").WithTags("Settings");

        group.MapGet("/", async (ISettingsService service, CancellationToken token) =>
        {
            var settings = await service.GetSettingsAsync(token);
            return Results.Ok(settings);
        });

        group.MapPut("/clinic-profile", async (UpdateClinicProfileCommand command, ISettingsService service, CancellationToken token) =>
        {
            try
            {
                var result = await service.UpdateClinicProfileAsync(command, token);
                return Results.Ok(result);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("modified by another user"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapPut("/branding", async (UpdateBrandingCommand command, ISettingsService service, CancellationToken token) =>
        {
            try
            {
                var result = await service.UpdateBrandingAsync(command, token);
                return Results.Ok(result);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("modified by another user"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapPut("/timezone-currency", async (UpdateTimezoneCurrencyCommand command, ISettingsService service, CancellationToken token) =>
        {
            try
            {
                var result = await service.UpdateTimezoneCurrencyAsync(command, token);
                return Results.Ok(result);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("modified by another user"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapPut("/appointments", async (UpdateAppointmentSettingsCommand command, ISettingsService service, CancellationToken token) =>
        {
            try
            {
                var result = await service.UpdateAppointmentSettingsAsync(command, token);
                return Results.Ok(result);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("modified by another user"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapPut("/prescriptions", async (UpdatePrescriptionSettingsCommand command, ISettingsService service, CancellationToken token) =>
        {
            try
            {
                var result = await service.UpdatePrescriptionSettingsAsync(command, token);
                return Results.Ok(result);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("modified by another user"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapPut("/notifications", async (UpdateNotificationSettingsCommand command, ISettingsService service, CancellationToken token) =>
        {
            try
            {
                var result = await service.UpdateNotificationSettingsAsync(command, token);
                return Results.Ok(result);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("modified by another user"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapPut("/inventory", async (UpdateInventorySettingsCommand command, ISettingsService service, CancellationToken token) =>
        {
            try
            {
                var result = await service.UpdateInventorySettingsAsync(command, token);
                return Results.Ok(result);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("modified by another user"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapPut("/pharmacy", async (UpdatePharmacySettingsCommand command, ISettingsService service, CancellationToken token) =>
        {
            try
            {
                var result = await service.UpdatePharmacySettingsAsync(command, token);
                return Results.Ok(result);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("modified by another user"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapPut("/finance", async (UpdateFinanceSettingsCommand command, ISettingsService service, CancellationToken token) =>
        {
            try
            {
                var result = await service.UpdateFinanceSettingsAsync(command, token);
                return Results.Ok(result);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("modified by another user"))
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapGet("/hours", async (ISettingsService service, CancellationToken token) =>
        {
            var hours = await service.GetClinicHoursAsync(token);
            return Results.Ok(hours);
        });

        group.MapPut("/hours", async (UpdateClinicHoursCommand command, ISettingsService service, CancellationToken token) =>
        {
            var result = await service.UpdateClinicHoursAsync(command, token);
            return Results.Ok(result);
        });

        group.MapGet("/holidays", async (ISettingsService service, CancellationToken token) =>
        {
            var holidays = await service.GetClinicHolidaysAsync(token);
            return Results.Ok(holidays);
        });

        group.MapPost("/holidays", async (UpsertClinicHolidayCommand command, ISettingsService service, CancellationToken token) =>
        {
            var result = await service.CreateClinicHolidayAsync(command, token);
            return Results.Created($"/api/settings/holidays/{result.Id}", result);
        });

        group.MapPut("/holidays/{id:guid}", async (Guid id, UpsertClinicHolidayCommand command, ISettingsService service, CancellationToken token) =>
        {
            var result = await service.UpdateClinicHolidayAsync(id, command, token);
            return Results.Ok(result);
        });

        group.MapDelete("/holidays/{id:guid}", async (Guid id, ISettingsService service, CancellationToken token) =>
        {
            await service.DeleteClinicHolidayAsync(id, token);
            return Results.NoContent();
        });

        group.MapGet("/user-preferences", async (ISettingsService service, CancellationToken token) =>
        {
            var prefs = await service.GetUserPreferenceAsync(token);
            return Results.Ok(prefs);
        });

        group.MapPut("/user-preferences", async (UpdateUserPreferenceCommand command, ISettingsService service, CancellationToken token) =>
        {
            var result = await service.UpdateUserPreferenceAsync(command, token);
            return Results.Ok(result);
        });

        return endpoints;
    }
}
