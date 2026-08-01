using System.Security.Cryptography;
using System.Text;

namespace Argyon.Backend.App.Shared.Services;

public static class JwtKeyGenerator
{
    public static byte[] GenerateKey(string password, string salt)
    {
        var saltBytes = Encoding.UTF8.GetBytes(salt);

        return Rfc2898DeriveBytes.Pbkdf2(
            password: password,
            salt: saltBytes,
            iterations: 10000,
            hashAlgorithm: HashAlgorithmName.SHA512,
            outputLength: 64
        );
    }
}