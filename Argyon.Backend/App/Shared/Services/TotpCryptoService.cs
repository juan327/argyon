using System.Security.Cryptography;

namespace Argyon.Backend.App.Shared.Services;

public static class TotpCryptoService
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    public static byte[] DeriveKey(IConfiguration configuration)
    {
        var totpSettings = configuration.GetSection("Totp");
        var password = totpSettings.GetValue<string>("EncryptionPassword") ?? string.Empty;
        var salt = totpSettings.GetValue<string>("EncryptionSalt") ?? string.Empty;
        return JwtKeyGenerator.GenerateKey(password, salt)[..32]; // AES-256
    }

    public static byte[] Encrypt(byte[] plaintext, byte[] key)
    {
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);

        var cipher = new byte[plaintext.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, plaintext, cipher, tag);

        var result = new byte[NonceSize + cipher.Length + TagSize];

        nonce.CopyTo(result.AsSpan(0));
        cipher.CopyTo(result.AsSpan(NonceSize));
        tag.CopyTo(result.AsSpan(NonceSize + cipher.Length));

        return result;
    }

    public static byte[] Decrypt(byte[] encryptedData, byte[] key)
    {
        if (encryptedData.Length < NonceSize + TagSize)
            throw new ArgumentException("Invalid encrypted data.");

        var cipherLength = encryptedData.Length - NonceSize - TagSize;

        var nonce = encryptedData.AsSpan(0, NonceSize);
        var cipher = encryptedData.AsSpan(NonceSize, cipherLength);
        var tag = encryptedData.AsSpan(NonceSize + cipherLength, TagSize);

        var plaintext = new byte[cipherLength];

        using var aes = new AesGcm(key, TagSize);
        aes.Decrypt(nonce, cipher, tag, plaintext);

        return plaintext;
    }
}
