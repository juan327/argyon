using Microsoft.Extensions.Localization;

// The project's RootNamespace ("Argyon.Backend", matching every "namespace Argyon.Backend..."
// declaration and the embedded .resx manifest names) differs from <AssemblyName>Argyon</AssemblyName>
// in Argyon.Backend.csproj. Without this attribute, Microsoft.Extensions.Localization's
// ResourceManagerStringLocalizerFactory falls back to the assembly's simple name ("Argyon") when
// computing the expected resource base name, gets "Argyon.Resources.SharedResource" instead of the
// real "Argyon.Backend.Resources.SharedResource", fails to find the manifest resource, and every
// IStringLocalizer<SharedResource>[...] lookup silently falls back to returning the raw key.
[assembly: RootNamespace("Argyon.Backend")]
