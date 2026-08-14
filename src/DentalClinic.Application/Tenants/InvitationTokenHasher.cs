using System.Security.Cryptography;
using System.Text;

namespace DentalClinic.Application.Tenants;

internal static class InvitationTokenHasher
{
    public static string Hash(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
