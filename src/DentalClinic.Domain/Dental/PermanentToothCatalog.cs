namespace DentalClinic.Domain.Dental;

public sealed record ToothDefinition(Guid Id, int Number);

public static class PermanentToothCatalog
{
    private static readonly IReadOnlyDictionary<int, ToothDefinition> Teeth =
        Enumerable.Range(1, 4)
            .SelectMany(quadrant => Enumerable.Range(1, 8).Select(position => quadrant * 10 + position))
            .ToDictionary(number => number, number =>
                new ToothDefinition(Guid.Parse($"00000000-0000-0000-0000-{number:D12}"), number));

    public static IReadOnlyCollection<ToothDefinition> All { get; } = Teeth.Values.ToArray();

    public static bool IsValid(int number) => Teeth.ContainsKey(number);

    public static ToothDefinition Get(int number) => Teeth.TryGetValue(number, out var tooth)
        ? tooth
        : throw new ArgumentOutOfRangeException(nameof(number), "A valid permanent FDI tooth number is required.");
}
