using System.Security.Cryptography;
using Konscious.Security.Cryptography;

public class PasswordService
{
    // Recommended parameters for Argon2id (2025)
    private const int SaltSize = 16;       // 128 bits
    private const int HashSize = 32;       // 256 bits
    private const int Iterations = 3;     // Number of passes
    private const int MemorySize = 65536; // 64 MB in KB
    private const int Parallelism = 4;    // Parallel threads

    /// <summary>
    /// Creates the hash of a password using Argon2id.
    /// </summary>
    public string HashPassword(string password)
    {
        byte[] salt = this.GenerateSalt();
        byte[] hash = this.ComputeHash(password, salt);

        // Format: Base64(salt):Base64(hash)
        return $"{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }

    /// <summary>
    /// Checks whether a password matches the stored hash.
    /// </summary>
    public bool VerifyPassword(string password, string storedHash)
    {
        string[] parts = storedHash.Split(':');
        if (parts.Length != 2)
            return false;

        byte[] salt = Convert.FromBase64String(parts[0]);
        byte[] expectedHash = Convert.FromBase64String(parts[1]);
        byte[] actualHash = this.ComputeHash(password, salt);

        // Constant-time comparison to avoid timing attacks
        return CryptographicOperations.FixedTimeEquals(expectedHash, actualHash);
    }

    private byte[] ComputeHash(string password, byte[] salt)
    {
        byte[] passwordBytes = System.Text.Encoding.UTF8.GetBytes(password);

        using var argon2 = new Argon2id(passwordBytes)
        {
            Salt = salt,
            DegreeOfParallelism = Parallelism,
            MemorySize = MemorySize,
            Iterations = Iterations
        };

        return argon2.GetBytes(HashSize);
    }

    private byte[] GenerateSalt()
    {
        return RandomNumberGenerator.GetBytes(SaltSize);
    }
}