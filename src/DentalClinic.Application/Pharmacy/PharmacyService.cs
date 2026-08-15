using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Inventory;
using DentalClinic.Application.Prescriptions;
using DentalClinic.Domain.Inventory;
using DentalClinic.Domain.Pharmacy;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Prescriptions;

namespace DentalClinic.Application.Pharmacy;

internal sealed class PharmacyService(
    IPharmacyStore store,
    IInventoryStore inventoryStore,
    IPrescriptionStore prescriptionStore,
    IPermissionService permissions,
    ICurrentTenant tenant,
    ICurrentUser user,
    ISystemClock clock
) : IPharmacyService
{
    public async Task<PharmacyDashboardSummaryDto> GetDashboardSummaryAsync(CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.PharmacyViewDashboard, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetDashboardSummaryAsync(tenantId, token);
    }

    public async Task<PagedResult<PharmacyDispensingSummaryDto>> GetDispensingsAsync(
        Guid? patientId,
        string? prescriptionNumber,
        string? medicationSearch,
        Guid? pharmacistId,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate,
        DispensingStatus? status,
        int pageNumber,
        int pageSize,
        CancellationToken token
    )
    {
        await permissions.EnsurePermissionAsync(Permissions.PharmacyViewHistory, token);
        var tenantId = tenant.RequireTenantId();
        ValidatePage(pageNumber, pageSize);
        return await store.GetDispensingsAsync(
            tenantId, patientId, prescriptionNumber, medicationSearch, pharmacistId, fromDate, toDate, status, pageNumber, pageSize, token
        );
    }

    public async Task<PharmacyDispensingDetailDto?> GetDispensingByIdAsync(Guid id, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.PharmacyViewHistory, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetDispensingDetailAsync(tenantId, id, token);
    }

    public async Task<PagedResult<PrescriptionReadyForDispensingDto>> GetPrescriptionsReadyForDispensingAsync(
        string? search,
        int pageNumber,
        int pageSize,
        CancellationToken token
    )
    {
        await permissions.EnsurePermissionAsync(Permissions.PharmacyView, token);
        var tenantId = tenant.RequireTenantId();
        ValidatePage(pageNumber, pageSize);
        return await store.GetPrescriptionsReadyForDispensingAsync(tenantId, search, pageNumber, pageSize, token);
    }

    public async Task<PrescriptionReadyForDispensingDto?> GetPrescriptionDispensingDetailAsync(Guid prescriptionId, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.PharmacyView, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetPrescriptionDispensingDetailAsync(tenantId, prescriptionId, token);
    }

    public async Task<PharmacyDispensingDetailDto> DispensePrescriptionAsync(DispensePrescriptionCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.PharmacyDispense, token);
        var tenantId = tenant.RequireTenantId();
        var userId = user.UserId ?? throw new UnauthorizedAccessException("Authenticated user is required to dispense.");

        if (command.Items == null || command.Items.Count == 0)
        {
            throw new PharmacyDispensingException("At least one item must be specified for dispensing.");
        }

        var prescription = await prescriptionStore.FindPrescriptionAsync(command.PrescriptionId, tracking: false, token)
            ?? throw new KeyNotFoundException("Prescription not found.");

        if (prescription.Status != PrescriptionStatus.Issued)
        {
            throw new PharmacyDispensingException("Only issued prescriptions can be dispensed.");
        }

        var previousDispensed = await store.GetTotalDispensedQuantitiesByPrescriptionIdAsync(tenantId, command.PrescriptionId, token);
        var seq = await store.GetNextDispensingSequenceValueAsync(tenantId, token);
        var dispensingNumber = $"DISP-{seq:D6}";

        var dispensing = new PharmacyDispensing(
            tenantId,
            prescription.Id,
            prescription.PatientId,
            dispensingNumber,
            userId,
            DispensingStatus.PartiallyDispensed,
            command.Notes,
            clock.UtcNow
        );

        foreach (var cmdItem in command.Items)
        {
            if (cmdItem.QuantityToDispense <= 0)
            {
                throw new PharmacyDispensingException("Quantity to dispense must be greater than zero.");
            }

            var rxItem = prescription.Items.FirstOrDefault(x => x.Id == cmdItem.PrescriptionItemId)
                ?? throw new KeyNotFoundException($"Prescription item '{cmdItem.PrescriptionItemId}' not found on prescription.");

            var prevQty = previousDispensed.GetValueOrDefault(rxItem.Id, 0m);

            if (rxItem.Quantity.HasValue)
            {
                var remaining = rxItem.Quantity.Value - prevQty;
                if (cmdItem.QuantityToDispense > remaining)
                {
                    throw new PharmacyDispensingException($"Cannot dispense {cmdItem.QuantityToDispense} for medication '{rxItem.MedicationNameSnapshot}'. Maximum remaining quantity is {remaining}.");
                }
            }

            var inventoryItem = await inventoryStore.FindItemByIdForUpdateAsync(tenantId, cmdItem.InventoryItemId, token)
                ?? throw new KeyNotFoundException($"Inventory item '{cmdItem.InventoryItemId}' not found or inaccessible.");

            if (!inventoryItem.IsActive)
            {
                throw new PharmacyDispensingException($"Inventory item '{inventoryItem.Name}' is inactive.");
            }

            var currentStock = await inventoryStore.GetCurrentStockForUpdateAsync(tenantId, inventoryItem.Id, token);
            if (currentStock < cmdItem.QuantityToDispense)
            {
                throw new InsufficientStockException($"Insufficient stock for '{inventoryItem.Name}'. Requested {cmdItem.QuantityToDispense}, available {currentStock}.");
            }

            var unitCost = inventoryItem.CurrentCost;
            var totalCost = unitCost * cmdItem.QuantityToDispense;

            var stockMov = new StockMovement(
                tenantId,
                inventoryItem.Id,
                StockMovementType.Issue,
                cmdItem.QuantityToDispense,
                unitCost,
                totalCost,
                clock.UtcNow,
                dispensingNumber,
                null,
                userId,
                $"Pharmacy dispensing for Rx {prescription.PrescriptionNumber}"
            );

            await inventoryStore.AddStockMovementAsync(stockMov, token);
            dispensing.AddItem(rxItem.Id, inventoryItem.Id, cmdItem.QuantityToDispense, unitCost, totalCost, stockMov.Id, clock.UtcNow);
        }

        // Check if all items with prescribed quantities are fully satisfied
        bool allSatisfied = true;
        foreach (var rxItem in prescription.Items)
        {
            if (rxItem.Quantity.HasValue)
            {
                var prevQty = previousDispensed.GetValueOrDefault(rxItem.Id, 0m);
                var newlyDispensed = command.Items.Where(x => x.PrescriptionItemId == rxItem.Id).Sum(x => x.QuantityToDispense);
                if (prevQty + newlyDispensed < rxItem.Quantity.Value)
                {
                    allSatisfied = false;
                    break;
                }
            }
        }

        if (allSatisfied)
        {
            dispensing.MarkFullyDispensed(clock.UtcNow);
        }

        await store.AddDispensingAsync(dispensing, token);
        await store.CommitAsync(token);

        var auditAction = dispensing.Status == DispensingStatus.FullyDispensed
            ? PlatformAuditAction.PharmacyDispensingFull
            : PlatformAuditAction.PharmacyDispensingPartial;

        prescriptionStore.AddAudit(new PlatformAuditLog(
            tenantId, userId, auditAction, "PharmacyDispensing", dispensing.Id, clock.UtcNow, null
        ));

        var result = await store.GetDispensingDetailAsync(tenantId, dispensing.Id, token);
        return result ?? throw new InvalidOperationException("Failed to load newly created dispensing detail.");
    }

    public async Task<PharmacyDispensingDetailDto> ReverseDispensingAsync(ReverseDispensingCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.PharmacyReverseDispensing, token);
        var tenantId = tenant.RequireTenantId();
        var userId = user.UserId ?? throw new UnauthorizedAccessException("Authenticated user is required to reverse dispensing.");

        if (string.IsNullOrWhiteSpace(command.Reason))
        {
            throw new PharmacyDispensingException("Reason for reversal is required.");
        }

        var dispensing = await store.FindDispensingByIdForUpdateAsync(tenantId, command.DispensingId, token)
            ?? throw new KeyNotFoundException("Dispensing record not found.");

        if (dispensing.Status == DispensingStatus.Reversed)
        {
            throw new PharmacyDispensingException("Dispensing record is already reversed.");
        }

        var existingReversal = await store.FindReversalByDispensingIdAsync(tenantId, dispensing.Id, token);
        if (existingReversal != null)
        {
            throw new PharmacyDispensingException("Dispensing record is already reversed.");
        }

        // Return stock for each item in dispensing
        Guid primaryStockMovementId = Guid.Empty;
        foreach (var item in dispensing.Items)
        {
            var inventoryItem = await inventoryStore.FindItemByIdForUpdateAsync(tenantId, item.InventoryItemId, token)
                ?? throw new KeyNotFoundException($"Inventory item '{item.InventoryItemId}' not found.");

            var stockMov = new StockMovement(
                tenantId,
                inventoryItem.Id,
                StockMovementType.Return,
                item.QuantityDispensed,
                item.UnitCost,
                item.TotalCost,
                clock.UtcNow,
                $"REV-{dispensing.DispensingNumber}",
                null,
                userId,
                $"Reversal of dispensing {dispensing.DispensingNumber}. Reason: {command.Reason.Trim()}"
            );

            await inventoryStore.AddStockMovementAsync(stockMov, token);
            if (primaryStockMovementId == Guid.Empty)
            {
                primaryStockMovementId = stockMov.Id;
            }
        }

        var reversal = new PharmacyDispensingReversal(
            tenantId,
            dispensing.Id,
            userId,
            clock.UtcNow,
            command.Reason,
            primaryStockMovementId
        );

        dispensing.MarkReversed(clock.UtcNow);
        await store.AddReversalAsync(reversal, token);
        await store.CommitAsync(token);

        prescriptionStore.AddAudit(new PlatformAuditLog(
            tenantId, userId, PlatformAuditAction.PharmacyDispensingReversed, "PharmacyDispensing", dispensing.Id, clock.UtcNow, null
        ));

        var result = await store.GetDispensingDetailAsync(tenantId, dispensing.Id, token);
        return result ?? throw new InvalidOperationException("Failed to load reversed dispensing detail.");
    }

    public async Task<IReadOnlyCollection<MedicationCatalogPharmacyDto>> GetMedicationCatalogAsync(string? search, bool? activeOnly, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.PharmacyView, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetMedicationCatalogAsync(tenantId, search, activeOnly, token);
    }

    public async Task UpdateMedicationInventoryMappingAsync(Guid medicationId, UpdateMedicationInventoryMappingCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.PharmacyEditCatalog, token);
        var tenantId = tenant.RequireTenantId();
        var userId = user.UserId;

        var medication = await prescriptionStore.FindMedicationAsync(medicationId, tracking: true, token)
            ?? throw new KeyNotFoundException("Medication catalog item not found.");

        if (command.InventoryItemId.HasValue && command.InventoryItemId.Value != Guid.Empty)
        {
            var invItem = await inventoryStore.FindItemByIdAsync(tenantId, command.InventoryItemId.Value, token)
                ?? throw new KeyNotFoundException("Inventory item to map was not found.");
        }

        medication.UpdatePharmacyDetails(command.Barcode, command.Manufacturer, command.ReorderLevel, command.InventoryItemId, clock.UtcNow);
        await prescriptionStore.SaveChangesAsync(token);

        prescriptionStore.AddAudit(new PlatformAuditLog(
            tenantId, userId, PlatformAuditAction.PharmacyMedicationMappingUpdated, "MedicationCatalogItem", medication.Id, clock.UtcNow, null
        ));
    }

    public async Task<IReadOnlyCollection<PatientPharmacyHistoryItemDto>> GetPatientPharmacyHistoryAsync(Guid patientId, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.PharmacyViewHistory, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetPatientPharmacyHistoryAsync(tenantId, patientId, token);
    }

    private static void ValidatePage(int pageNumber, int pageSize)
    {
        if (pageNumber < 1) throw new ArgumentOutOfRangeException(nameof(pageNumber), "Page number must be at least 1.");
        if (pageSize is < 1 or > 100) throw new ArgumentOutOfRangeException(nameof(pageSize), "Page size must be between 1 and 100.");
    }
}
