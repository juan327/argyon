using Argyon.Backend.App.Shared.Entities;

namespace Argyon.Backend.App.Shared.IServices;

public interface INoteLimitService
{
    // Returns null if creation is allowed, or an error message if the limit is exceeded.
    Task<string?> CheckLimit(EntityUser caller, bool isFolder, int itemsToAdd = 1);
}
