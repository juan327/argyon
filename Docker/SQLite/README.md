# Argyon on Docker (SQLite)

This folder (`Docker/SQLite/`) contains everything needed to run Argyon (backend + frontend, in a single container) with **SQLite** as the database, without installing the .NET SDK, Node.js, or pnpm on the host machine. SQLite doesn't need a separate database server: the `database.db` file is created automatically inside the container itself (`/app/Data/Database`) on first startup.

- [`Dockerfile`](Dockerfile) — multi-stage build: compiles the frontend (Angular), copies it into `Argyon.Backend/wwwroot`, publishes the backend (.NET), and generates the final runtime image.
- [`docker-compose.yaml`](docker-compose.yaml) — brings up the Argyon backend with a persistent volume for the data, using the **official image** published on Docker Hub (`juan327/argyon:latest`). No need for the source code or building anything locally.
- [`docker-compose.build.yaml`](docker-compose.build.yaml) — same as above, but **builds the image locally** from this folder's `Dockerfile` instead of pulling the official image. Useful if you modified the source code or want to avoid depending on Docker Hub.
- [`appsettings.json`](appsettings.json) — default values for all NON-sensitive configuration (Cors, ForwardedHeaders, Jwt Issuer/Audience/expiration, VaultFreshness, Attachments, RateLimiting); both compose files mount it as a read-only volume over the image's `appsettings.json`. Edit it directly to change these values instead of touching the `docker-compose*.yaml`.
- [`.env.example`](.env.example) — environment variable template for the compose (copy it to `.env`); only covers the required cryptographic secrets.

> [!IMPORTANT]
> The `Dockerfile` needs to see both `Argyon.Backend/` and `Argyon.Frontend/`, so the **build context must always be the repository root**, not this folder. All commands in this guide already account for that (`-f Docker/SQLite/Dockerfile ...` with context `.` at the root).

## Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/) 24+ (includes Docker Compose v2 as a plugin, `docker compose`).
- No other requirements: the .NET SDK, Node.js, and pnpm are only used **inside** the image, at build time. No external database server needed.

## Option A — With `docker compose` (recommended)

1. Copy the environment template and fill it in (from the repository root):

   The template is at [`Docker/SQLite/.env.example`](.env.example). Copy it to `Docker/SQLite/.env` and fill in the 4 variables marked as REQUIRED: `JWT_PASSWORD`, `JWT_SALT`, `TOTP_ENCRYPTION_PASSWORD`, and `TOTP_ENCRYPTION_SALT`. Generate each secret with something like `openssl rand -base64 48`. `Docker/SQLite/.env` is in `.gitignore`: it's never committed to the repository.

2. Bring up the service (`app`), picking one of the two compose files:

   - **Official image** (`docker-compose.yaml`, recommended — pulls `juan327/argyon:latest` from Docker Hub, doesn't need the source code):

     ```bash
     docker compose -f Docker/SQLite/docker-compose.yaml up -d
     ```

   - **Local build** (`docker-compose.build.yaml` — builds the image from the `Dockerfile`, useful if you modified the code):

     ```bash
     docker compose -f Docker/SQLite/docker-compose.build.yaml up -d --build
     ```

3. Open `http://localhost:8080` — both the API and the already-built SPA are served there.

4. To view logs / stop / restart (swap `docker-compose.yaml` for `docker-compose.build.yaml` if you used the local build):

   ```bash
   docker compose -f Docker/SQLite/docker-compose.yaml logs -f app
   docker compose -f Docker/SQLite/docker-compose.yaml down
   docker compose -f Docker/SQLite/docker-compose.yaml pull && docker compose -f Docker/SQLite/docker-compose.yaml up -d   # update to the latest official image
   ```

With the official image, the compose uses `juan327/argyon:latest` (service `app`, container `argyon-app`); with the local build, it creates the `argyon` image from the `Dockerfile`.

The compose creates a named volume (persists between `down`/`up`, deleted with `down -v`):

- `argyon-data` — the backend's `Data/Database/database.db` (the SQLite database, created automatically on first startup) and `Data/Attachments` (encrypted attachments).

It also mounts [`Docker/SQLite/appsettings.json`](appsettings.json) as a read-only bind mount over `/app/appsettings.json`, with the default values for the NON-sensitive configuration.

## Option B — Without `docker compose` (`docker build` / `docker run`)

### 1. Get the image

You can use the **official image** published on Docker Hub directly (no source code needed):

```bash
docker pull juan327/argyon:latest
```

In the `docker run` commands in this section, substitute `argyon` with `juan327/argyon:latest`.

Alternatively, to **build the image locally** from the source code (from the repository root, named `argyon`):

```bash
docker build -f Docker/SQLite/Dockerfile -t argyon .
```

### 2. Run

`Database:Provider` already defaults to `Sqlite` in `appsettings.json`, so no database connection variable is needed: the required secrets are enough.

```bash
docker run -d --name argyon-app \
  -p 8080:8080 \
  -v argyon-data:/app/Data \
  -e Jwt__Password=<jwt-secret> \
  -e Jwt__Salt=<jwt-salt> \
  -e Totp__EncryptionPassword=<totp-secret> \
  -e Totp__EncryptionSalt=<totp-salt> \
  argyon
```

Open `http://localhost:8080`. The `database.db` file will end up in the `argyon-data` volume (`Data/Database/database.db`), alongside the attachments.

## Configuration: `appsettings.json` vs. environment variables

Just like in a non-Docker deployment (see the "Configuration" section of the [main README](../../README.md)), all settings are read from ASP.NET Core's standard `IConfiguration`: any `appsettings.json` field can be overridden with an equivalent environment variable using `__` (double underscore) as the level separator — for example `Jwt__Password` overrides `Jwt:Password`.

With `docker compose`, this is split across two files with separate responsibilities:

- **[`Docker/SQLite/appsettings.json`](appsettings.json)** — only **NON-sensitive** configuration, with default values already tailored to this compose (`Database:Provider=Sqlite`, CORS, ForwardedHeaders, Jwt Issuer/Audience/expiration, VaultFreshness, Attachments, RateLimiting). `docker-compose.yaml` mounts it as a read-only volume over `/app/appsettings.json`, replacing the `appsettings.json` baked into the image. To change any of these values, edit this file directly (no need to rebuild the image, just restart the `app` container).
- **`docker-compose.yaml` (`environment:` block)** — only the **sensitive** variables (`Jwt`/`Totp` secrets/salts), taken from `Docker/SQLite/.env` (see [`.env.example`](.env.example)). These must never be written into `appsettings.json`.

Any field — sensitive or not — can also be overridden on a one-off basis by adding its corresponding `__` variable to the `environment:` block of `docker-compose.yaml` (environment variables always take priority over `appsettings.json`).

### Sensitive environment variables (`docker-compose.yaml` / `.env`)

| Environment variable | Field in `appsettings.json` | Description | Default value |
|---|---|---|---|
| `Kestrel__Endpoints__Http__Url` | `Kestrel:Endpoints:Http:Url` | URL/port Kestrel listens on inside the container. | `http://+:8080` (already set in the `Dockerfile`) |
| `Jwt__Password` | `Jwt:Password` | Secret to derive the session JWT signing key. | *(empty, required)* |
| `Jwt__Salt` | `Jwt:Salt` | Salt used together with `Jwt:Password`. | *(empty, required)* |
| `Totp__EncryptionPassword` | `Totp:EncryptionPassword` | Secret to encrypt each user's TOTP secret in the DB. | *(empty, required)* |
| `Totp__EncryptionSalt` | `Totp:EncryptionSalt` | Salt used together with `Totp:EncryptionPassword`. | *(empty, required)* |

### NON-sensitive configuration (`Docker/SQLite/appsettings.json`)

| Field in `appsettings.json` | Description | Default value in this compose |
|---|---|---|
| `Database:Provider` | Database provider: `Sqlite` or `Postgresql`. | `Sqlite` |
| `Cors:AllowedOrigins` | Origins allowed by CORS. Usually not needed if the frontend is served from this same backend. | `http://localhost:8080` |
| `ForwardedHeaders:Enabled` | Processes `X-Forwarded-*` headers (needed behind a reverse proxy). | `false` |
| `ForwardedHeaders:TrustAnyProxy` | Trusts `X-Forwarded-*` from any origin. | `false` |
| `ForwardedHeaders:KnownProxies` | Trusted proxy IPs. | `127.0.0.1`, `::1` |
| `ForwardedHeaders:KnownNetworks` | Trusted proxy CIDR ranges. | `127.0.0.0/8` |
| `ForwardedHeaders:ForwardLimit` | Max number of proxy hops to process. | `1` |
| `Jwt:Issuer` | `iss` claim of issued JWTs. | `Argyon` |
| `Jwt:Audience` | `aud` claim validated on JWTs. | `Argyon` |
| `Jwt:AccessTokenExpiryMinutes` | Access token validity in minutes. | `15` |
| `Jwt:RefreshTokenExpiryDays` | Session/refresh token validity in days. | `14` |
| `VaultFreshness:RequireReverifyMinutes` | Minutes after which sensitive operations require re-verifying the password/vault. | `60` |
| `Attachments:MaxUploadSizeMb` | Maximum size (MB) allowed for attachments. | `500` |
| `RateLimiting:Public:Enabled` | Enables rate limiting for public endpoints. | `true` |
| `RateLimiting:Public:PermitLimit` | Max number of public requests per window. | `60` |
| `RateLimiting:Public:WindowSeconds` | Duration (s) of the public counting window. | `60` |
| `RateLimiting:Public:QueueLimit` | Public requests queued before rejecting. | `0` |
| `RateLimiting:Authenticated:Enabled` | Enables rate limiting for authenticated endpoints. | `true` |
| `RateLimiting:Authenticated:PermitLimit` | Max number of authenticated requests per window. | `300` |
| `RateLimiting:Authenticated:WindowSeconds` | Duration (s) of the authenticated counting window. | `60` |
| `RateLimiting:Authenticated:QueueLimit` | Authenticated requests queued before rejecting. | `0` |

### Environment variables with sensitive data

> [!WARNING]
> These variables are cryptographic secrets. **It's strongly recommended to always set them via environment variable** (ideally with a secrets manager: Docker secrets, Vault, your deployment platform's secret store, etc.) and not leave them written in `appsettings.json` or the `Dockerfile`. The repository's example values are for local development only and must never be reused in production.

| Environment variable | Description | Criticality |
|---|---|---|
| `Jwt__Password` | Session JWT signing secret. | 🔴 Critical — must be changed |
| `Jwt__Salt` | Salt used together with `Jwt__Password`. | 🔴 Critical — must be changed |
| `Totp__EncryptionPassword` | Encrypts each user's TOTP secret in the DB. | 🔴 Critical — must be changed |
| `Totp__EncryptionSalt` | Salt used together with `Totp__EncryptionPassword`. | 🔴 Critical — must be changed |

In `docker-compose.yaml` these values are taken from `Docker/SQLite/.env` (see [`.env.example`](.env.example)); in `docker run` they're passed with `-e`.

## Production notes

- **TLS / HTTPS**: the container only listens on HTTP on port `8080` (Kestrel has no certificate configured). To expose it on the Internet, place it behind a reverse proxy (Nginx, Traefik, Caddy, etc.) that terminates TLS and forwards `X-Forwarded-Proto`/`X-Forwarded-For`; then set `ForwardedHeaders:Enabled` to `true` and `ForwardedHeaders:KnownProxies`/`KnownNetworks` (or `TrustAnyProxy` to `true` only if you fully control the internal network) in `Docker/SQLite/appsettings.json` so the app recognizes that proxy.
- With `ASPNETCORE_ENVIRONMENT=Production` (the default value in this image), ASP.NET Core automatically adds the HSTS header to responses. If you're testing the container locally over `http://` from a browser, keep in mind HSTS can make the browser force `https://` on later visits to the same host; for local HTTP testing you can override `ASPNETCORE_ENVIRONMENT=Development` (`ASPNETCORE_ENVIRONMENT` variable in `Docker/SQLite/.env` or `-e` in `docker run`).
- The app uses `EnsureCreated()` (not EF migrations) to create the SQLite schema on first startup — no manual migration step is needed.
- SQLite is a single file: it doesn't support multiple backend replicas writing to the same volume at once. If you need to scale horizontally, use the [`Docker/Postgresql`](../Postgresql/README.md) compose instead.
</content>
