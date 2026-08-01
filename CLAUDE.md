# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tool usage

- Do not ask the user to run commands in a terminal or console (`bash`, `cmd`, `PowerShell`, `zsh`, etc.).
- Whenever an action can be performed with the tools available to you, use them directly.
- Do not ask the user to copy and paste commands when you can complete the task yourself.
- Only request user intervention when an action requires permissions, authentication, explicit confirmation, or an operation none of your tools can perform.
- If you need to inspect files, modify them, run tests, or perform any other task supported by your tools, do it directly without asking the user for further instructions.
- Before requesting any manual action, check whether you can resolve it using the capabilities available in your environment.

## Local PrimeNG documentation

- Under the relative path `.claude/tutorials/primeng`, you'll find markdown files describing PrimeNG components.
- If the component you need isn't documented there, you may use other methods to find PrimeNG documentation. It's important to prioritize the local docs in your environment.

## Project overview

Argyon is a zero-knowledge encrypted notes app: a .NET 10 Web API backend (`Argyon.Backend/`) serving a static Angular 21 SPA (`Argyon.Frontend/`). All note content is encrypted/decrypted client-side; the server only ever stores ciphertext and never sees the user's master password or vault key.

## Commands

### Backend (Argyon.Backend)

- Build: `dotnet build Argyon.Backend/Argyon.Backend.csproj`
- Run (dev): `dotnet run --project Argyon.Backend` (or use the VS Code "API" launch config, which sets `ASPNETCORE_ENVIRONMENT=Development`)
- The API uses SQLite; the DB file is created at `Argyon.Backend/Data/Database/database.db` on first run — no separate migration step is required to get started.

### Frontend (Argyon.Frontend)

Run pnpm commands with `--dir Argyon.Frontend` (or `cd` into that directory first):

- Install deps: `pnpm install --dir Argyon.Frontend`
- Dev server: `pnpm --dir Argyon.Frontend start` (serves at `http://localhost:4200/`)
- Build: `pnpm --dir Argyon.Frontend run build` (output to `Argyon.Frontend/dist/`)
- Test (Vitest via Angular's unit-test builder): `pnpm --dir Argyon.Frontend test`
- The API's CORS origin defaults to `http://localhost:4200` (configurable via `Cors:AllowedOrigins` in appsettings).

## Architecture

### Backend — feature-folder + service pattern

Each feature lives under `Argyon.Backend/App/Controllers/<Feature>/` with a consistent set of files: `<Feature>Controller.cs`, `I<Feature>Service.cs`, `<Feature>Service.cs`, `VM<Feature>.cs` (request view-models, one nested class per action, e.g. `VMNote.VMPost`), and `DTO<Feature>.cs` (response payloads). Controllers are thin: they just call the matching service method and return `StatusCode((int)statusCode, response)` — all validation and business logic lives in the service, which returns a `(HttpStatusCode, DTOResponse...)` tuple. Current features: `User`, `Note`, `Folder`, `Totp`.

Shared infrastructure lives in `Argyon.Backend/App/Shared/`:
- `Database/DataContext.cs` — EF Core `DbContext` (SQLite). All `DateTime` properties are forced to `DateTimeKind.Utc` via a global value converter.
- `Entities/` — EF entities (`EntityUser`, `EntityNote`, `EntityUserSession`, `EntityUserTotp`, `EntityUserRecoveryCode`, `EntityRole`). Notes and folders share a single `notes` table (`EntityNote.IsFolder` flag); a note's parent is tracked via a plain `ParentId` column (no navigation property, so no DB-level FK/cascade — deletes cascade to descendants explicitly in `NoteService.Delete` by walking `ParentId` in memory).
- `DTO/DTOGeneric.cs` — generic response envelope types (`DTOResponseApi`, `DTOResponseApiData<T>`, `DTOResponseApiListData<T>`) used by every controller response.
- `Services/` — Argon2id password hashing (via `Konscious.Security.Cryptography.Argon2`), `JwtKeyGenerator`, and `GenericService` for JWT/session issuance.
- `Scopeds/JwtEventsHandler.cs` — custom `JwtBearerEvents`: reads the JWT from the `access_token` HttpOnly cookie (not the `Authorization` header), validates the session against `UserSessions` in the DB, and caches valid token→userId lookups in an in-memory `MemoryCache` keyed by token expiry. Sets `HttpContext.Items["UserId"]`, which every authenticated service method reads to identify the caller.
- `Middlewares/GenericMiddleware.cs` — placeholder pipeline middleware for cross-cutting request/response logic.
- `HostedServices/` — `StartupTask` (seed roles/etc. on boot) and `BackgroundTask` (recurring hosted service).

Auth flow: login/register issue a JWT stored in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie (`access_token`); there is no bearer-token-in-header flow. Sessions are tracked server-side in the `UserSessions` table so they can be revoked on logout.

### TOTP / 2FA

Two-factor auth is implemented via `Otp.NET`:
- `Totp/Setup` → `Enable` → `Disable` → `RegenerateRecoveryCodes` → `Status` manage the authenticated user's TOTP config (`UserTotps` table) and hashed recovery codes (`UserRecoveryCodes` table). The SPA renders the QR code with the `qrcode` package (`pages/main/pages/settings/twoFactor.service.ts`).
- Login with TOTP enabled does **not** issue a session: `User/Login` returns a short-lived (5 min) *pending token* instead, and the anonymous `Totp/VerifyLogin` endpoint validates the pending token + TOTP/recovery code, then issues the real session cookie and returns the vault-key wrapping info.

### Zero-knowledge encryption model (critical to preserve when touching auth or notes)

The server never has access to plaintext notes or the encryption key. Key hierarchy, implemented in `Argyon.Frontend/src/app/shared/services/auth.service.ts`:

1. **Vault Key (DEK)** — a random AES-256-GCM key generated client-side (`CreateVault`) that actually encrypts/decrypts note content. It is never sent to the server in raw form and never derived from the password.
2. **KEK (key-encryption-key)** — derived client-side from the user's master password via Argon2id (`argon2-browser`, params `KDF_MEMORY`/`KDF_ITERATIONS`/`KDF_PARALLELISM`/`KDF_HASH_LENGTH` in `auth.service.ts`). Used only to wrap/unwrap the Vault Key; never leaves the client.
3. The server stores only: password hash (Argon2id, server-side via `PasswordService`), the Argon2 salt + KDF params used for the *KEK*, and the AES-GCM-wrapped Vault Key + its IV (`EntityUser.EncryptedVaultKey*`/`Kdf*` columns). Login/`ValidatePassword` return this wrapping info (`DTOUser.DTOVaultKeyInfo`) so the client can re-derive the KEK and unwrap the Vault Key locally.
4. `CipherService` (`shared/services/cipher.service.ts`) does per-field AES-GCM encrypt/decrypt using the active Vault Key (`AuthService.cryptoKey`). Note `name`, `description`, `tags`, and `data` are each encrypted independently with their own randomly generated IV (`EntityNote.NameIv`/`DescriptionIv`/`TagsIv`/`DataIv`) — IVs are never reused across fields.
5. Changing the master password (`ChangePassword`) only re-wraps the existing Vault Key with a new KEK — note ciphertext is never touched/re-encrypted.

`DatabaseService` (`shared/services/database.service.ts`) pulls the flat encrypted note list from `GET Note`, decrypts each note client-side, and rebuilds the folder/note tree from each note's `parentId`.

**When adding fields to notes/users that contain sensitive data, they must be encrypted client-side before hitting `HttpService`, and the corresponding entity column added as ciphertext (+ IV if not reusing the record's existing IV) — never add a plaintext sensitive column server-side.**

### Frontend — Angular 21, signals, standalone components

- Routing (`app.routes.ts`) is hash-based (`withHashLocation()`) since the SPA is served as static files from the API's `wwwroot`. Routes are lazy-loaded via `loadComponent()`. `AuthGuard` protects the `''` (main) route tree; unmatched routes redirect to `/login`.
- State is signal-based (`signal`/`computed`), not RxJS/NgRx, for app state (e.g. `DatabaseService.notes`, `AuthService.unlocked`).
- `HttpService` (`shared/services/http.service.ts`) wraps `HttpClient` with `withCredentials: true` (required for the auth cookie) and centralizes 401-handling (redirects to `/login`). All API calls should go through it (`Get`/`Post`/`PostForm`/`Put`/`PutForm`/`Delete`/`Ping`) rather than injecting `HttpClient` directly.
- Feature folders under `pages/` follow `pages/<feature>/` with colocated `.component.ts` + `.service.ts`; the main app shell is `pages/main/` with sub-pages under `pages/main/pages/` (`home`, `data`, `settings`) and layout pieces under `pages/main/partials/` (`nav`, `note`, `unlock`).
- Shared DTOs/VMs mirroring the backend contracts live in `shared/dto/` and `shared/vm/`, re-exported via `index.ts` barrel files.
- Reusable form/UI components live in `shared/components/` (`component-button`, `component-inputText`, `component-inputPassword`, `component-inputTextArea`, `component-dialog`, etc.), styled with the CSS custom properties from `src/styles.css`. PrimeNG (Aura preset, configured in `app.config.ts`) + Tailwind CSS are also available; prefer the local PrimeNG docs in `.claude/tutorials/primeng/` before searching externally (per instructions above).
- Tests run on Vitest via the Angular CLI's `@angular/build:unit-test` builder (see `angular.json`), not Karma/Jasmine.

### Styling — read `guia de diseño de la pagina.md` before creating/styling components

The repo root contains `guia de diseño de la pagina.md`, the mandatory design-system guide. Key rules:
- Two themes (dark default / light) switched via `data-theme` on the root element. **Never hardcode colors** — always use the semantic CSS custom properties from `styles.css` (`--bg-*` elevation layers, `--color-<severity>` with `-light`/`-dark` variants, `--text-*`, `--border-*`, `--radius-*`, `--shadow-*`).
- Components with color variants take a `severity` (`primary`/`secondary`/`accent`/`success`/`warning`/`error`/`info`/`danger`): base color at rest, `-dark` on hover/active, `-light` for the 3px `box-shadow` focus ring (native `outline` is always removed; use `:focus-visible` on buttons, `:focus` on inputs).
- For SVGs/assets that can't use CSS variables, adapt to light theme with `:host-context([data-theme="light"])`.

### Angular conventions (also in `.github/copilot-instructions.md`)

- Standalone components only; do NOT set `standalone: true` (default in v20+). `ChangeDetectionStrategy.OnPush` on every component.
- `input()`/`output()`/`model()` functions instead of decorators; `inject()` instead of constructor injection; host bindings via the `host` object, not `@HostBinding`/`@HostListener`.
- Native control flow (`@if`, `@for`, `@switch`) — never `*ngIf`/`*ngFor`/`*ngSwitch`. No arrow functions in templates. `class`/`style` bindings instead of `ngClass`/`ngStyle`.
- Signals for state (`update`/`set`, never `mutate`); Reactive forms over template-driven; shared form components integrate with signal forms via a `FieldTree` `formField` input.
- Avoid `any` (use `unknown`); template/style URLs relative to the component `.ts` file.
