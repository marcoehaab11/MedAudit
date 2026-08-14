using System.Security.Cryptography;
using DentalClinic.Application.Tenants;
using Microsoft.AspNetCore.WebUtilities;

namespace DentalClinic.Infrastructure.Identity;

internal sealed class SecureInvitationTokenGenerator : IInvitationTokenGenerator
{
    public string Generate() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
}
