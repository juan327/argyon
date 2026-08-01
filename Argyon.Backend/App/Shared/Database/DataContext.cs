using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Argyon.Backend.App.Shared.Entities;

namespace ApiSqliteDemo.Data;

public class DataContext : DbContext
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<EntityUser>().HasKey(u => u.Id);
        builder.Entity<EntityUserSession>().HasKey(us => us.Token);
        builder.Entity<EntityRefreshToken>().HasKey(rt => rt.Id);
        builder.Entity<EntityRefreshToken>().HasIndex(rt => rt.TokenHash).IsUnique();
        builder.Entity<EntityRefreshToken>().HasIndex(rt => rt.FamilyId);
        builder.Entity<EntityNote>().HasKey(n => n.Id);
        builder.Entity<EntityNote>().HasIndex(n => new { n.UserId, n.IsFolder, n.UpdatedAt });
        builder.Entity<EntityNote>().HasIndex(n => n.ParentId);
        builder.Entity<EntityNoteAttachment>().HasKey(a => a.Id);
        builder.Entity<EntityNoteAttachment>().HasIndex(a => a.NoteId);
        builder.Entity<EntityNoteAttachment>().HasIndex(a => a.UserId);
        builder.Entity<EntityUserTotp>().HasKey(t => t.Id);
        builder.Entity<EntityUserTotp>().HasIndex(t => t.UserId).IsUnique();
        builder.Entity<EntityUserRecoveryCode>().HasKey(rc => rc.Id);
        builder.Entity<EntitySystemSettings>().HasKey(s => s.Id);
        builder.Entity<EntityUserPermissions>().HasKey(p => p.Id);
        builder.Entity<EntityUserPermissions>().HasIndex(p => p.UserId).IsUnique();

        var utcConverter = new ValueConverter<DateTime, DateTime>(
            v => v,
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime))
                {
                    property.SetValueConverter(utcConverter);
                }
            }
        }
    }
    
    public DataContext(DbContextOptions<DataContext> options)
        : base(options)
    {
        
    }

    public DbSet<EntityUser> Users => Set<EntityUser>();
    public DbSet<EntityUserSession> UserSessions => Set<EntityUserSession>();
    public DbSet<EntityRefreshToken> RefreshTokens => Set<EntityRefreshToken>();
    public DbSet<EntityNote> Notes => Set<EntityNote>();
    public DbSet<EntityNoteAttachment> NoteAttachments => Set<EntityNoteAttachment>();
    public DbSet<EntityUserTotp> UserTotps => Set<EntityUserTotp>();
    public DbSet<EntityUserRecoveryCode> UserRecoveryCodes => Set<EntityUserRecoveryCode>();
    public DbSet<EntitySystemSettings> SystemSettings => Set<EntitySystemSettings>();
    public DbSet<EntityUserPermissions> UserPermissions => Set<EntityUserPermissions>();
}
