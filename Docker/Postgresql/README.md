# Argyon on Docker (PostgreSQL)

This folder (`Docker/Postgresql/`) contains everything needed to run Argyon (backend + frontend, in a single container) alongside a **PostgreSQL** database, without installing the .NET SDK, Node.js, or pnpm on the host machine.

- [`Dockerfile`](Dockerfile) — multi-stage build: compiles the frontend (Angular), copies it into `Argyon.Backend/wwwroot`, publishes the backend (.NET), and generates the final runtime image.
- [`docker-compose.yaml`](docker-compose.yaml) — brings up the Argyon backend alongside a PostgreSQL container, using the **official image** published on Docker Hub (`juan327/argyon:latest`), with persistent volumes and a healthcheck. Doesn't require the source code or building anything locally.
- [`docker-compose.build.yaml`](docker-compose.build.yaml) — same as the above, but **builds the image locally** from this folder's `Dockerfile` instead of downloading the official image. Useful if you've modified the source code or want to avoid depending on Docker Hub.
- [`appsettings.json`](appsettings.json) — default values for all NON-sensitive configuration (Cors, ForwardedHeaders, Jwt Issuer/Audience/expiration, VaultFreshness, Attachments, RateLimiting); both composes mount it as a read-only volume over the image's `appsettings.json`. Edit it directly to change these values instead of touching `docker-compose*.yaml`.
- [`.env.example`](.env.example) — environment variable template for the compose (copy it to `.env`); only covers sensitive data and the PostgreSQL connection.

> [!IMPORTANT]
> The `Dockerfile` needs to see both `Argyon.Backend/` and `Argyon.Frontend/`, so the **build context must always be the repository root**, not this folder. All commands in this guide already account for that (`-f Docker/Postgresql/Dockerfile ...` with context `.` at the root).

## Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/) 24+ (includes Docker Compose v2 as a plugin, `docker compose`).
- No other requirements: the .NET SDK, Node.js, and pnpm are only used **inside** the image, at build time.

## Option A — With `docker compose` (recommended)

1. Copy the environment template and fill it in (from the repository root):

   The template is at [`Docker/Postgresql/.env.example`](.env.example). Copy it to `Docker/Postgresql/.env` and fill in, at minimum, `POSTGRES_PASSWORD`, `JWT_PASSWORD`, `JWT_SALT`, `TOTP_ENCRYPTION_PASSWORD`, and `TOTP_ENCRYPTION_SALT` (the 5 variables marked as required inside the file). Generate each secret with something like `openssl rand -base64 32`. `Docker/Postgresql/.env` is in `.gitignore`: it's never committed to the repository.

2. Bring up the services (`app` + `db`), choosing one of the two composes:

   - **Official image** (`docker-compose.yaml`, recommended — downloads `juan327/argyon:latest` from Docker Hub, doesn't need the source code):

     ```bash
     docker compose -f Docker/Postgresql/docker-compose.yaml up -d
     ```

   - **Local build** (`docker-compose.build.yaml` — builds the image from the `Dockerfile`, useful if you modified the code):

     ```bash
     docker compose -f Docker/Postgresql/docker-compose.build.yaml up -d --build
     ```

3. Open `http://localhost:8080` — both the API and the already-built SPA are served there.

4. To view logs / stop / restart (replace `docker-compose.yaml` with `docker-compose.build.yaml` if you used the local build):

   ```bash
   docker compose -f Docker/Postgresql/docker-compose.yaml logs -f app
   docker compose -f Docker/Postgresql/docker-compose.yaml down
   docker compose -f Docker/Postgresql/docker-compose.yaml pull && docker compose -f Docker/Postgresql/docker-compose.yaml up -d   # update to the latest official image
   ```

With the official image, the compose uses `juan327/argyon:latest` (service `app`, container `argyon-app`); with the local build, it creates the `argyon` image from the `Dockerfile`. In both cases `postgres:17-alpine` is used for the `db` service (container `argyon-db`).

The compose creates two named volumes (persist between `down`/`up`, deleted with `down -v`):

- `argyon-postgres-data` — PostgreSQL data.
- `argyon-data` — the backend's `Data/Attachments` (encrypted attachments). `Data/Database` also lives here but is only used if you switch to `Database__Provider=Sqlite`.

It also mounts [`Docker/Postgresql/appsettings.json`](appsettings.json) as a read-only bind mount over `/app/appsettings.json`, with the default values for the NON-sensitive configuration.

## Option B — Without `docker compose` (`docker build` / `docker run`)

### 1. Get the image

You can use the **official image** published on Docker Hub directly (no need for the source code):

```bash
docker pull juan327/argyon:latest
```

In the `docker run` commands in this section, replace `argyon` with `juan327/argyon:latest`.

Alternatively, to **build the image locally** from the source code (from the repository root, named `argyon`):

```bash
docker build -f Docker/Postgresql/Dockerfile -t argyon .
```

### 2. Run with PostgreSQL

First create a network and a PostgreSQL container (or use an existing one and adjust `--network`/host):

```bash
docker network create argyon-net

docker run -d --name argyon-db \
  --network argyon-net \
  -e POSTGRES_USER=argyon \
  -e POSTGRES_PASSWORD=<strong-password> \
  -e POSTGRES_DB=argyon \
  -v argyon-postgres-data:/var/lib/postgresql/data \
  postgres:17-alpine

docker run -d --name argyon-app \
  --network argyon-net \
  -p 8080:8080 \
  -v argyon-data:/app/Data \
  -e Database__Provider=Postgresql \
  -e Database__Postgresql__Host=argyon-db \
  -e Database__Postgresql__Port=5432 \
  -e Database__Postgresql__Username=argyon \
  -e Database__Postgresql__Password=<strong-password> \
  -e Database__Postgresql__Database=argyon \
  -e Jwt__Password=<jwt-secret> \
  -e Jwt__Salt=<jwt-salt> \
  -e Totp__EncryptionPassword=<totp-secret> \
  -e Totp__EncryptionSalt=<totp-salt> \
  argyon
```

Open `http://localhost:8080`.

### 3. Minimal alternative with SQLite (without PostgreSQL)

If you just want to try the image quickly and don't need PostgreSQL, `Database:Provider` already defaults to `Sqlite` in `appsettings.json`, so the required secrets are enough:

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

The SQLite `database.db` file will end up in the `argyon-data` volume (`Data/Database/database.db`), alongside the attachments.

## Configuration: `appsettings.json` vs. environment variables

Just like in a non-Docker deployment (see the "Configuration" section of the [main README](../../README.md)), all settings are read from ASP.NET Core's standard `IConfiguration`: any `appsettings.json` field can be overridden with an equivalent environment variable using `__` (double underscore) as the level separator — for example `Jwt__Password` overrides `Jwt:Password`.

With `docker compose`, this is split across two files with separate responsibilities:

- **[`Docker/Postgresql/appsettings.json`](appsettings.json)** — only **NON-sensitive** configuration, with default values already tailored to this compose (`Database:Provider=Postgresql`, CORS, ForwardedHeaders, Jwt Issuer/Audience/expiration, VaultFreshness, Attachments, RateLimiting). `docker-compose.yaml` mounts it as a read-only volume over `/app/appsettings.json`, replacing the `appsettings.json` baked into the image. To change any of these values, edit this file directly (no need to rebuild the image, just restart the `app` container).
- **`docker-compose.yaml` (`environment:` block)** — only **sensitive** variables (`Jwt`/`Totp` passwords/salts, PostgreSQL password) and the PostgreSQL connection credentials (host/port/user/database), taken from `Docker/Postgresql/.env` (see [`.env.example`](.env.example)). These must never be written into `appsettings.json`.

Any field — sensitive or not — can also be overridden on a one-off basis by adding its corresponding `__` variable to the `environment:` block of `docker-compose.yaml` (environment variables always take priority over `appsettings.json`).

### Sensitive environment variables (`docker-compose.yaml` / `.env`)

| Environment variable | Field in `appsettings.json` | Description | Default value |
|---|---|---|---|
| `Kestrel__Endpoints__Http__Url` | `Kestrel:Endpoints:Http:Url` | URL/port Kestrel listens on inside the container. | `http://+:8080` (already set in the `Dockerfile`) |
| `Database__Postgresql__Host` (compose: `POSTGRES_HOST`) | `Database:Postgresql:Host` | PostgreSQL server host. Controlled with `POSTGRES_HOST` in `docker-compose.yaml`. | `argyon-db` (this same compose's `db` container) |
| `Database__Postgresql__Port` (compose: `POSTGRES_PORT`) | `Database:Postgresql:Port` | PostgreSQL server port. Controlled with `POSTGRES_PORT` in `docker-compose.yaml`. | `5432` |
| `Database__Postgresql__Username` | `Database:Postgresql:Username` | PostgreSQL connection user. | `argyon` |
| `Database__Postgresql__Password` | `Database:Postgresql:Password` | PostgreSQL connection password. | *(empty, required)* |
| `Database__Postgresql__Database` | `Database:Postgresql:Database` | PostgreSQL database name. | `argyon` |
| `Jwt__Password` | `Jwt:Password` | Secret to derive the session JWT signing key. | *(empty, required)* |
| `Jwt__Salt` | `Jwt:Salt` | Salt used together with `Jwt:Password`. | *(empty, required)* |
| `Totp__EncryptionPassword` | `Totp:EncryptionPassword` | Secret to encrypt each user's TOTP secret in the DB. | *(empty, required)* |
| `Totp__EncryptionSalt` | `Totp:EncryptionSalt` | Salt used together with `Totp:EncryptionPassword`. | *(empty, required)* |

### NON-sensitive configuration (`Docker/Postgresql/appsettings.json`)

| Field in `appsettings.json` | Description | Default value in this compose |
|---|---|---|
| `Database:Provider` | Database provider: `Sqlite` or `Postgresql`. | `Postgresql` |
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
> These variables are cryptographic secrets or connection credentials. **It's strongly recommended to always set them via environment variable** (ideally with a secrets manager: Docker secrets, Vault, your deployment platform's secret store, etc.) and not leave them written in `appsettings.json` or the `Dockerfile`. The repository's example values are for local development only and must never be reused in production.

| Environment variable | Description | Criticality |
|---|---|---|
| `Database__Postgresql__Host` | PostgreSQL server host. | 🟠 Credential |
| `Database__Postgresql__Username` | PostgreSQL connection user. | 🟠 Credential |
| `Database__Postgresql__Password` | PostgreSQL connection password. | 🔴 Critical |
| `Database__Postgresql__Database` | PostgreSQL database name. | 🟠 Credential |
| `Jwt__Password` | Session JWT signing secret. | 🔴 Critical — must be changed |
| `Jwt__Salt` | Salt used together with `Jwt__Password`. | 🔴 Critical — must be changed |
| `Totp__EncryptionPassword` | Encrypts each user's TOTP secret in the DB. | 🔴 Critical — must be changed |
| `Totp__EncryptionSalt` | Salt used together with `Totp__EncryptionPassword`. | 🔴 Critical — must be changed |

In `docker-compose.yaml` these values are taken from `Docker/Postgresql/.env` (see [`.env.example`](.env.example)); in `docker run` they're passed with `-e`.

## Production notes

- **TLS / HTTPS**: the container only listens on HTTP on port `8080` (Kestrel has no certificate configured). To expose it on the Internet, place it behind a reverse proxy (Nginx, Traefik, Caddy, etc.) that terminates TLS and forwards `X-Forwarded-Proto`/`X-Forwarded-For`; then set `ForwardedHeaders:Enabled` to `true` and `ForwardedHeaders:KnownProxies`/`KnownNetworks` (or `TrustAnyProxy` to `true` only if you fully control the internal network) in `Docker/Postgresql/appsettings.json` so the app recognizes that proxy.
- With `ASPNETCORE_ENVIRONMENT=Production` (the default value in this image), ASP.NET Core automatically adds the HSTS header to responses. If you're testing the container locally over `http://` from a browser, keep in mind HSTS can make the browser force `https://` on later visits to the same host; for local HTTP testing you can override `ASPNETCORE_ENVIRONMENT=Development` (`ASPNETCORE_ENVIRONMENT` variable in `Docker/Postgresql/.env` or `-e` in `docker run`).
- The app uses `EnsureCreated()` (not EF migrations) to create the schema on first startup, both with SQLite and PostgreSQL — no manual migration step is needed.
</content>
