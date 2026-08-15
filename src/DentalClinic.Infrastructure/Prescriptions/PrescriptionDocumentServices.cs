using System.Security.Cryptography;
using System.Text;
using System.Globalization;
using DentalClinic.Application.Prescriptions;
using Microsoft.AspNetCore.WebUtilities;
using QRCoder;

namespace DentalClinic.Infrastructure.Prescriptions;

internal sealed class SecurePrescriptionReferenceGenerator : IPrescriptionReferenceGenerator
{ public string Generate() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32)); }

internal sealed class PrescriptionQrCodeService : IPrescriptionQrCodeService
{
    public string GenerateSvg(string payload)
    { using var data = QRCodeGenerator.GenerateQrCode(payload, QRCodeGenerator.ECCLevel.Q); using var code = new SvgQRCode(data); return code.GetGraphic(5); }
}

internal sealed class PrescriptionDocumentService(IPrescriptionQrCodeService qrCodes) : IPrescriptionDocumentService
{
    public Task<PrescriptionDocument> GenerateAsync(PrescriptionDocumentModel model, CancellationToken token)
    {
        token.ThrowIfCancellationRequested(); var lines = new List<string> { model.Clinic.Name, $"{model.Clinic.Address}, {model.Clinic.City}, {model.Clinic.Country}", $"Phone: {model.Clinic.Phone}", $"Prescription {model.PrescriptionNumber}", $"Issued {model.IssuedAt:yyyy-MM-dd}", $"Patient: {model.PatientName}", $"Doctor: {model.DoctorName} - {model.DoctorSpecialization} ({model.DoctorLicense})", string.Empty };
        foreach (var item in model.Items.OrderBy(x => x.SortOrder)) lines.Add($"{item.SortOrder}. {item.MedicationName} {item.Strength} | {item.Dose} | {item.Frequency} | {item.Duration} | {item.Route} | {item.Instructions}");
        if (!string.IsNullOrWhiteSpace(model.Notes)) lines.Add($"Notes: {model.Notes}"); lines.Add(string.Empty); lines.Add("Doctor signature: ______________________________"); lines.Add($"Verification: {model.VerificationReference}");
        _ = qrCodes.GenerateSvg(model.VerificationReference); var content = BuildPdf(lines); return Task.FromResult(new PrescriptionDocument(content, "application/pdf", $"{model.PrescriptionNumber}.pdf"));
    }
    private static byte[] BuildPdf(IEnumerable<string> lines)
    {
        var text = new StringBuilder("BT /F1 11 Tf 45 790 Td 14 TL "); foreach (var line in lines.Take(45)) text.Append('(').Append(Escape(ToLatin(line))).Append(") Tj T* "); text.Append("ET");
        var stream = text.ToString(); var objects = new[] { "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", $"<< /Length {Encoding.ASCII.GetByteCount(stream)} >>\nstream\n{stream}\nendstream", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" };
        var output = new StringBuilder("%PDF-1.4\n"); var offsets = new List<int> { 0 }; for (var i = 0; i < objects.Length; i++) { offsets.Add(Encoding.ASCII.GetByteCount(output.ToString())); output.Append(i + 1).Append(" 0 obj\n").Append(objects[i]).Append("\nendobj\n"); }
        var xref = Encoding.ASCII.GetByteCount(output.ToString()); output.Append("xref\n0 ").Append(objects.Length + 1).Append("\n0000000000 65535 f \n"); foreach (var offset in offsets.Skip(1)) output.Append(offset.ToString("0000000000", CultureInfo.InvariantCulture)).Append(" 00000 n \n"); output.Append("trailer << /Size ").Append(objects.Length + 1).Append(" /Root 1 0 R >>\nstartxref\n").Append(xref).Append("\n%%EOF"); return Encoding.ASCII.GetBytes(output.ToString());
    }
    private static string Escape(string value) => value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("(", "\\(", StringComparison.Ordinal).Replace(")", "\\)", StringComparison.Ordinal);
    private static string ToLatin(string value) => new(value.Select(x => x is >= ' ' and <= '~' ? x : '?').ToArray());
}

internal sealed class UnconfiguredSpeechToTextService : ISpeechToTextService
{ public Task<string> TranscribeAsync(Stream audio, string? language, CancellationToken token) => throw new NotSupportedException("Speech transcription provider is not configured."); }
