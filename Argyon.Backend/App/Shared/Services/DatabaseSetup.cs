using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Argyon.Backend.App.Shared.Services;

public class DatabaseSettings
{
    public string Provider { get; set; } = "Sqlite";
    public PostgresqlSettings Postgresql { get; set; } = new();
}

public class PostgresqlSettings
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 5432;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Database { get; set; } = string.Empty;
}

public static class DatabaseSetup
{
    public static DatabaseSettings GetSettings(IConfiguration configuration)
    {
        return configuration.GetSection("Database").Get<DatabaseSettings>() ?? new DatabaseSettings();
    }

    public static void Configure(DbContextOptionsBuilder options, DatabaseSettings settings, string sqliteDbPath)
    {
        if (string.Equals(settings.Provider, "Postgresql", StringComparison.OrdinalIgnoreCase) == true)
        {
            var postgresql = settings.Postgresql;

            if (string.IsNullOrWhiteSpace(postgresql.Host) == true
                || string.IsNullOrWhiteSpace(postgresql.Username) == true
                || string.IsNullOrWhiteSpace(postgresql.Password) == true
                || string.IsNullOrWhiteSpace(postgresql.Database) == true)
            {
                throw new InvalidOperationException(
                    "Database:Provider is \"Postgresql\" but one or more of Database:Postgresql:Host/Username/Password/Database is missing in configuration.");
            }

            var connectionStringBuilder = new NpgsqlConnectionStringBuilder
            {
                Host = postgresql.Host,
                Port = postgresql.Port,
                Username = postgresql.Username,
                Password = postgresql.Password,
                Database = postgresql.Database,
            };

            options.UseNpgsql(connectionStringBuilder.ConnectionString);
            return;
        }

        options.UseSqlite($"Data Source={sqliteDbPath}");
    }
}
