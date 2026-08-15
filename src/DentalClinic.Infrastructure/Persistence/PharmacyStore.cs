using DentalClinic.Application.Pharmacy;
using DentalClinic.Domain.Pharmacy;
using DentalClinic.Domain.Prescriptions;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class PharmacyStore(ApplicationDbContext context) : IPharmacyStore
{
    public async Task<PharmacyDispensing?> FindDispensingByIdAsync(Guid tenantId, Guid dispensingId, CancellationToken token)
    {
        return await context.PharmacyDispensings
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == dispensingId, token);
    }

    public async Task<PharmacyDispensing?> FindDispensingByIdForUpdateAsync(Guid tenantId, Guid dispensingId, CancellationToken token)
    {
        return await context.PharmacyDispensings
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == dispensingId, token);
    }

    public async Task<PharmacyDispensingReversal?> FindReversalByDispensingIdAsync(Guid tenantId, Guid dispensingId, CancellationToken token)
    {
        return await context.PharmacyDispensingReversals
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.DispensingId == dispensingId, token);
    }

    public async Task<IReadOnlyCollection<PharmacyDispensingItem>> GetDispensingItemsForPrescriptionAsync(Guid tenantId, Guid prescriptionId, CancellationToken token)
    {
        return await context.PharmacyDispensings
            .Where(x => x.TenantId == tenantId && x.PrescriptionId == prescriptionId && x.Status != DispensingStatus.Reversed)
            .SelectMany(x => x.Items)
            .ToListAsync(token);
    }

    public async Task<IReadOnlyDictionary<Guid, decimal>> GetTotalDispensedQuantitiesByPrescriptionIdAsync(Guid tenantId, Guid prescriptionId, CancellationToken token)
    {
        var items = await context.PharmacyDispensings
            .Where(x => x.TenantId == tenantId && x.PrescriptionId == prescriptionId && x.Status != DispensingStatus.Reversed)
            .SelectMany(x => x.Items)
            .GroupBy(x => x.PrescriptionItemId)
            .Select(g => new { PrescriptionItemId = g.Key, TotalDispensed = g.Sum(x => x.QuantityDispensed) })
            .ToListAsync(token);

        return items.ToDictionary(x => x.PrescriptionItemId, x => x.TotalDispensed);
    }

    public async Task<PagedResult<PharmacyDispensingSummaryDto>> GetDispensingsAsync(
        Guid tenantId,
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
        var query = context.PharmacyDispensings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId);

        if (patientId.HasValue && patientId.Value != Guid.Empty)
        {
            query = query.Where(x => x.PatientId == patientId.Value);
        }

        if (pharmacistId.HasValue && pharmacistId.Value != Guid.Empty)
        {
            query = query.Where(x => x.DispensedByUserId == pharmacistId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(x => x.Status == status.Value);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(x => x.DispensedAt >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(x => x.DispensedAt <= toDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(prescriptionNumber))
        {
            var rxPattern = $"%{prescriptionNumber.Trim()}%";
            var rxIds = await context.Prescriptions
                .Where(x => x.TenantId == tenantId && EF.Functions.ILike(x.PrescriptionNumber, rxPattern))
                .Select(x => x.Id)
                .ToListAsync(token);

            query = query.Where(x => rxIds.Contains(x.PrescriptionId));
        }

        if (!string.IsNullOrWhiteSpace(medicationSearch))
        {
            var medPattern = $"%{medicationSearch.Trim()}%";
            var matchedDispensingIds = await context.PharmacyDispensingItems
                .Where(x => x.TenantId == tenantId)
                .Join(context.InventoryItems.Where(i => i.TenantId == tenantId),
                    d => d.InventoryItemId,
                    i => i.Id,
                    (d, i) => new { d.DispensingId, i.Name, i.ArabicName })
                .Where(x => EF.Functions.ILike(x.Name, medPattern) || (x.ArabicName != null && EF.Functions.ILike(x.ArabicName, medPattern)))
                .Select(x => x.DispensingId)
                .Distinct()
                .ToListAsync(token);

            query = query.Where(x => matchedDispensingIds.Contains(x.Id));
        }

        var totalCount = await query.CountAsync(token);

        var rawItems = await query
            .OrderByDescending(x => x.DispensedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.DispensingNumber,
                x.PrescriptionId,
                x.PatientId,
                x.Status,
                x.DispensedAt,
                x.DispensedByUserId,
                ItemCount = x.Items.Count
            })
            .ToListAsync(token);

        var patientIds = rawItems.Select(x => x.PatientId).Distinct().ToList();
        var rxIdsForSummary = rawItems.Select(x => x.PrescriptionId).Distinct().ToList();
        var userIds = rawItems.Select(x => x.DispensedByUserId).Distinct().ToList();

        var patients = await context.Patients
            .Where(x => x.TenantId == tenantId && patientIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => $"{x.FirstName} {x.LastName}", token);

        var prescriptions = await context.Prescriptions
            .Where(x => x.TenantId == tenantId && rxIdsForSummary.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.PrescriptionNumber, token);

        var users = await context.ClinicUsers
            .Where(x => x.TenantId == tenantId && userIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.DisplayName, token);

        var dtos = rawItems.Select(x => new PharmacyDispensingSummaryDto(
            x.Id,
            x.DispensingNumber,
            x.PrescriptionId,
            prescriptions.GetValueOrDefault(x.PrescriptionId, string.Empty),
            x.PatientId,
            patients.GetValueOrDefault(x.PatientId, "Unknown Patient"),
            x.Status,
            x.DispensedAt,
            x.DispensedByUserId,
            users.GetValueOrDefault(x.DispensedByUserId),
            x.ItemCount
        )).ToList();

        return new PagedResult<PharmacyDispensingSummaryDto>(dtos, totalCount, pageNumber, pageSize);
    }

    public async Task<PharmacyDispensingDetailDto?> GetDispensingDetailAsync(Guid tenantId, Guid dispensingId, CancellationToken token)
    {
        var dispensing = await context.PharmacyDispensings
            .AsNoTracking()
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == dispensingId, token);

        if (dispensing == null) return null;

        var patient = await context.Patients
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == dispensing.PatientId, token);

        var prescription = await context.Prescriptions
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == dispensing.PrescriptionId, token);

        var dispensedByUser = await context.ClinicUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == dispensing.DispensedByUserId, token);

        var inventoryIds = dispensing.Items.Select(i => i.InventoryItemId).Distinct().ToList();
        var rxItemIds = dispensing.Items.Select(i => i.PrescriptionItemId).Distinct().ToList();

        var inventoryItems = await context.InventoryItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && inventoryIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, token);

        var rxItems = await context.PrescriptionItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && rxItemIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, token);

        var reversal = await context.PharmacyDispensingReversals
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.DispensingId == dispensingId, token);

        PharmacyDispensingReversalDto? reversalDto = null;
        if (reversal != null)
        {
            var reversedByUser = await context.ClinicUsers
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == reversal.ReversedByUserId, token);

            reversalDto = new PharmacyDispensingReversalDto(
                reversal.Id,
                reversal.ReversedByUserId,
                reversedByUser?.DisplayName,
                reversal.ReversedAt,
                reversal.Reason,
                reversal.StockMovementId
            );
        }

        var itemDtos = dispensing.Items.Select(item =>
        {
            inventoryItems.TryGetValue(item.InventoryItemId, out var inv);
            rxItems.TryGetValue(item.PrescriptionItemId, out var rxItem);

            return new PharmacyDispensingItemDetailDto(
                item.Id,
                item.PrescriptionItemId,
                rxItem?.MedicationNameSnapshot ?? "Unknown Medication",
                item.InventoryItemId,
                inv?.Name ?? "Unknown Item",
                inv?.Sku ?? string.Empty,
                item.QuantityDispensed,
                item.UnitCost,
                item.TotalCost,
                item.StockMovementId
            );
        }).ToList();

        return new PharmacyDispensingDetailDto(
            dispensing.Id,
            dispensing.DispensingNumber,
            dispensing.PrescriptionId,
            prescription?.PrescriptionNumber ?? string.Empty,
            dispensing.PatientId,
            patient != null ? $"{patient.FirstName} {patient.LastName}" : "Unknown Patient",
            dispensing.Status,
            dispensing.DispensedAt,
            dispensing.DispensedByUserId,
            dispensedByUser?.DisplayName,
            dispensing.Notes,
            dispensing.Version,
            itemDtos,
            reversalDto
        );
    }

    public async Task<PagedResult<PrescriptionReadyForDispensingDto>> GetPrescriptionsReadyForDispensingAsync(
        Guid tenantId,
        string? search,
        int pageNumber,
        int pageSize,
        CancellationToken token
    )
    {
        var query = context.Prescriptions
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Status == PrescriptionStatus.Issued);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            var patientIds = await context.Patients
                .Where(x => x.TenantId == tenantId && (EF.Functions.ILike(x.FirstName, pattern) || EF.Functions.ILike(x.LastName, pattern)))
                .Select(x => x.Id)
                .ToListAsync(token);

            query = query.Where(x => EF.Functions.ILike(x.PrescriptionNumber, pattern) || patientIds.Contains(x.PatientId));
        }

        var totalCount = await query.CountAsync(token);

        var rxList = await query
            .OrderByDescending(x => x.IssuedAt ?? x.CreatedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(token);

        var rxIds = rxList.Select(x => x.Id).ToList();
        var patientIdsDistinct = rxList.Select(x => x.PatientId).Distinct().ToList();
        var doctorProfileIds = rxList.Select(x => x.DoctorProfileId).Distinct().ToList();

        var patients = await context.Patients
            .Where(x => x.TenantId == tenantId && patientIdsDistinct.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => $"{x.FirstName} {x.LastName}", token);

        var doctors = await context.DoctorProfiles
            .Where(x => x.TenantId == tenantId && doctorProfileIds.Contains(x.Id))
            .Join(context.ClinicUsers.Where(u => u.TenantId == tenantId),
                d => d.ClinicUserId,
                u => u.Id,
                (d, u) => new { DoctorId = d.Id, u.DisplayName })
            .ToDictionaryAsync(x => x.DoctorId, x => x.DisplayName, token);

        var allItems = await context.PrescriptionItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && rxIds.Contains(x.PrescriptionId))
            .ToListAsync(token);

        var previousDispensings = await context.PharmacyDispensings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && rxIds.Contains(x.PrescriptionId) && x.Status != DispensingStatus.Reversed)
            .SelectMany(x => x.Items)
            .GroupBy(x => x.PrescriptionItemId)
            .Select(g => new { PrescriptionItemId = g.Key, TotalDispensed = g.Sum(x => x.QuantityDispensed) })
            .ToDictionaryAsync(x => x.PrescriptionItemId, x => x.TotalDispensed, token);

        var medIds = allItems.Where(i => i.MedicationId.HasValue).Select(i => i.MedicationId!.Value).Distinct().ToList();
        var medicationMap = await context.MedicationCatalogItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && medIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, token);

        var invIds = medicationMap.Values.Where(m => m.InventoryItemId.HasValue).Select(m => m.InventoryItemId!.Value).Distinct().ToList();
        var inventoryItemsMap = await context.InventoryItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && invIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, token);

        var stockBalances = new Dictionary<Guid, decimal>();
        foreach (var invId in invIds)
        {
            var stock = await context.StockMovements
                .AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.ItemId == invId)
                .SumAsync(x => x.Quantity, token);
            stockBalances[invId] = stock;
        }

        var resultList = new List<PrescriptionReadyForDispensingDto>();
        foreach (var rx in rxList)
        {
            var rxItems = allItems.Where(i => i.PrescriptionId == rx.Id).Select(i =>
            {
                var totalDispensed = previousDispensings.GetValueOrDefault(i.Id, 0m);
                var prescribedQty = (decimal)(i.Quantity ?? 0);
                var remainingQty = i.Quantity.HasValue ? Math.Max(0m, prescribedQty - totalDispensed) : 0m;

                Guid? mappedInvId = null;
                string? mappedInvName = null;
                decimal availStock = 0m;

                if (i.MedicationId.HasValue && medicationMap.TryGetValue(i.MedicationId.Value, out var medItem) && medItem.InventoryItemId.HasValue)
                {
                    mappedInvId = medItem.InventoryItemId.Value;
                    if (inventoryItemsMap.TryGetValue(mappedInvId.Value, out var inv))
                    {
                        mappedInvName = inv.Name;
                        availStock = stockBalances.GetValueOrDefault(mappedInvId.Value, 0m);
                    }
                }

                return new PrescriptionItemDispensingStateDto(
                    i.Id,
                    i.MedicationId,
                    i.MedicationNameSnapshot,
                    i.GenericNameSnapshot,
                    i.StrengthSnapshot,
                    i.FormSnapshot,
                    i.Dose,
                    i.Frequency,
                    i.Duration,
                    i.Instructions,
                    i.Quantity,
                    totalDispensed,
                    remainingQty,
                    mappedInvId,
                    mappedInvName,
                    availStock
                );
            }).ToList();

            resultList.Add(new PrescriptionReadyForDispensingDto(
                rx.Id,
                rx.PrescriptionNumber,
                rx.PatientId,
                patients.GetValueOrDefault(rx.PatientId, "Unknown Patient"),
                rx.DoctorProfileId,
                doctors.GetValueOrDefault(rx.DoctorProfileId, "Unknown Doctor"),
                rx.IssuedAt ?? rx.CreatedAt,
                rx.Status.ToString(),
                rxItems
            ));
        }

        return new PagedResult<PrescriptionReadyForDispensingDto>(resultList, totalCount, pageNumber, pageSize);
    }

    public async Task<PrescriptionReadyForDispensingDto?> GetPrescriptionDispensingDetailAsync(Guid tenantId, Guid prescriptionId, CancellationToken token)
    {
        var result = await GetPrescriptionsReadyForDispensingAsync(tenantId, null, 1, 100, token);
        return result.Items.FirstOrDefault(x => x.PrescriptionId == prescriptionId);
    }

    public async Task<IReadOnlyCollection<MedicationCatalogPharmacyDto>> GetMedicationCatalogAsync(Guid tenantId, string? search, bool? activeOnly, CancellationToken token)
    {
        var query = context.MedicationCatalogItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId);

        if (activeOnly == true)
        {
            query = query.Where(x => x.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(x => EF.Functions.ILike(x.Name, pattern) || (x.GenericName != null && EF.Functions.ILike(x.GenericName, pattern)) || (x.Barcode != null && EF.Functions.ILike(x.Barcode, pattern)));
        }

        var medList = await query.OrderBy(x => x.Name).ToListAsync(token);
        var invIds = medList.Where(x => x.InventoryItemId.HasValue).Select(x => x.InventoryItemId!.Value).Distinct().ToList();

        var inventoryItemsMap = await context.InventoryItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && invIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, token);

        var stockBalances = new Dictionary<Guid, decimal>();
        foreach (var invId in invIds)
        {
            var stock = await context.StockMovements
                .AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.ItemId == invId)
                .SumAsync(x => x.Quantity, token);
            stockBalances[invId] = stock;
        }

        return medList.Select(x =>
        {
            string? invName = null;
            string? invSku = null;
            decimal? stock = null;

            if (x.InventoryItemId.HasValue && inventoryItemsMap.TryGetValue(x.InventoryItemId.Value, out var inv))
            {
                invName = inv.Name;
                invSku = inv.Sku;
                stock = stockBalances.GetValueOrDefault(inv.Id, 0m);
            }

            return new MedicationCatalogPharmacyDto(
                x.Id,
                x.Name,
                x.GenericName,
                x.Strength,
                x.Form,
                x.Notes,
                x.Barcode,
                x.Manufacturer,
                x.ReorderLevel,
                x.InventoryItemId,
                invName,
                invSku,
                stock,
                x.IsActive,
                x.CreatedAt,
                x.UpdatedAt
            );
        }).ToList();
    }

    public async Task<IReadOnlyCollection<PatientPharmacyHistoryItemDto>> GetPatientPharmacyHistoryAsync(Guid tenantId, Guid patientId, CancellationToken token)
    {
        var dispensings = await context.PharmacyDispensings
            .AsNoTracking()
            .Include(x => x.Items)
            .Where(x => x.TenantId == tenantId && x.PatientId == patientId)
            .OrderByDescending(x => x.DispensedAt)
            .ToListAsync(token);

        if (dispensings.Count == 0) return [];

        var rxIds = dispensings.Select(x => x.PrescriptionId).Distinct().ToList();
        var rxItems = await context.PrescriptionItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && rxIds.Contains(x.PrescriptionId))
            .ToDictionaryAsync(x => x.Id, token);

        var rxMap = await context.Prescriptions
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && rxIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.PrescriptionNumber, token);

        var result = new List<PatientPharmacyHistoryItemDto>();
        foreach (var disp in dispensings)
        {
            var rxNumber = rxMap.GetValueOrDefault(disp.PrescriptionId, string.Empty);
            foreach (var item in disp.Items)
            {
                rxItems.TryGetValue(item.PrescriptionItemId, out var rxItem);
                var prescribedQty = rxItem?.Quantity ?? 0;

                result.Add(new PatientPharmacyHistoryItemDto(
                    disp.Id,
                    disp.DispensingNumber,
                    disp.PrescriptionId,
                    rxNumber,
                    rxItem?.MedicationNameSnapshot ?? "Unknown Medication",
                    prescribedQty,
                    item.QuantityDispensed,
                    Math.Max(0m, prescribedQty - item.QuantityDispensed),
                    disp.Status,
                    disp.DispensedAt
                ));
            }
        }

        return result;
    }

    public async Task<PharmacyDashboardSummaryDto> GetDashboardSummaryAsync(Guid tenantId, CancellationToken token)
    {
        var todayStart = DateTimeOffset.UtcNow.Date;
        var todayEnd = todayStart.AddDays(1);

        var waitingForDispensingCount = await context.Prescriptions
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Status == PrescriptionStatus.Issued)
            .CountAsync(token);

        var partiallyDispensedCount = await context.PharmacyDispensings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Status == DispensingStatus.PartiallyDispensed)
            .CountAsync(token);

        var fullyDispensedTodayCount = await context.PharmacyDispensings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Status == DispensingStatus.FullyDispensed && x.DispensedAt >= todayStart && x.DispensedAt < todayEnd)
            .CountAsync(token);

        var dispensingCountToday = await context.PharmacyDispensings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.DispensedAt >= todayStart && x.DispensedAt < todayEnd)
            .CountAsync(token);

        var mappedInvIds = await context.MedicationCatalogItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.InventoryItemId != null)
            .Select(x => x.InventoryItemId!.Value)
            .Distinct()
            .ToListAsync(token);

        int lowStockCount = 0;
        foreach (var invId in mappedInvIds)
        {
            var invItem = await context.InventoryItems
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == invId, token);

            if (invItem != null)
            {
                var stock = await context.StockMovements
                    .AsNoTracking()
                    .Where(x => x.TenantId == tenantId && x.ItemId == invId)
                    .SumAsync(x => x.Quantity, token);

                if (stock <= invItem.MinimumStockLevel || stock <= invItem.ReorderLevel)
                {
                    lowStockCount++;
                }
            }
        }

        var recentList = await GetDispensingsAsync(tenantId, null, null, null, null, null, null, null, 1, 10, token);

        return new PharmacyDashboardSummaryDto(
            waitingForDispensingCount,
            partiallyDispensedCount,
            fullyDispensedTodayCount,
            dispensingCountToday,
            lowStockCount,
            recentList.Items
        );
    }

    public async Task AddDispensingAsync(PharmacyDispensing dispensing, CancellationToken token)
    {
        await context.PharmacyDispensings.AddAsync(dispensing, token);
    }

    public async Task AddReversalAsync(PharmacyDispensingReversal reversal, CancellationToken token)
    {
        await context.PharmacyDispensingReversals.AddAsync(reversal, token);
    }

    public async Task<long> GetNextDispensingSequenceValueAsync(Guid tenantId, CancellationToken token)
    {
        var seq = await context.Set<PharmacyDispensingNumberSequence>()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, token);

        if (seq == null)
        {
            await context.Database.ExecuteSqlRawAsync(
                "INSERT INTO pharmacy_dispensing_number_sequences (\"TenantId\", \"LastValue\") VALUES ({0}, 1) ON CONFLICT DO NOTHING;",
                tenantId
            );

            seq = await context.Set<PharmacyDispensingNumberSequence>()
                .FirstOrDefaultAsync(x => x.TenantId == tenantId, token);
        }

        await context.Database.ExecuteSqlRawAsync(
            "UPDATE pharmacy_dispensing_number_sequences SET \"LastValue\" = \"LastValue\" + 1 WHERE \"TenantId\" = {0};",
            tenantId
        );

        var val = await context.Set<PharmacyDispensingNumberSequence>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.LastValue)
            .FirstOrDefaultAsync(token);

        return val <= 0 ? 1 : val;
    }

    public async Task CommitAsync(CancellationToken token)
    {
        await context.SaveChangesAsync(token);
    }
}
