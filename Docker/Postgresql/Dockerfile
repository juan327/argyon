# syntax=docker/dockerfile:1
#
# Multi-stage build for Argyon (backend .NET 10 + frontend Angular 21).
# The frontend is compiled DIRECTLY into Argyon.Backend/wwwroot (see
# "outputPath" in Argyon.Frontend/angular.json), and that already-built
# wwwroot is automatically included in the backend's publish output as
# static files served by Kestrel (UseDefaultFiles / UseStaticFiles).
#
# IMPORTANT: this Dockerfile must be built with the context at the
# repository ROOT (not inside Docker/Postgresql/), because it needs to see
# both Argyon.Backend/ and Argyon.Frontend/. See Docker/Postgresql/README.md
# for the full command (with and without docker-compose).

##############################
# 1) Frontend build (Angular)
##############################
FROM node:22-alpine AS frontend-build
WORKDIR /src

# Installs pnpm at the version pinned by the project (packageManager in package.json).
RUN corepack enable && corepack prepare pnpm@11.15.0 --activate

# Copies only the manifests first to take advantage of Docker's layer cache.
COPY Argyon.Frontend/package.json Argyon.Frontend/pnpm-lock.yaml Argyon.Frontend/pnpm-workspace.yaml ./Argyon.Frontend/
WORKDIR /src/Argyon.Frontend
RUN pnpm install --frozen-lockfile

# Copies the rest of the frontend source code and builds in production mode.
COPY Argyon.Frontend/ ./
RUN mkdir -p /src/Argyon.Backend/wwwroot && pnpm run build

##############################
# 2) Backend restore + publish (.NET)
##############################
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src

COPY Argyon.Backend/Argyon.Backend.csproj Argyon.Backend/
RUN dotnet restore Argyon.Backend/Argyon.Backend.csproj

COPY Argyon.Backend/ Argyon.Backend/
# Replaces wwwroot (empty/nonexistent in the checkout) with the Angular
# build generated in the previous stage, so "dotnet publish" packages it as
# static content.
COPY --from=frontend-build /src/Argyon.Backend/wwwroot Argyon.Backend/wwwroot

RUN dotnet publish Argyon.Backend/Argyon.Backend.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

##############################
# 3) Final runtime image
##############################
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Must be kept in sync with <Version> in Argyon.Backend/Argyon.Backend.csproj.
LABEL org.opencontainers.image.version="0.0.3"

COPY --from=backend-build /app/publish .

# App's persistent data directory (Data/Database -> only used with
# Database:Provider=Sqlite; Data/Attachments -> encrypted attachments, always
# used, even with PostgreSQL). Created and handed over to the image's
# non-root user ($APP_UID) BEFORE a volume is mounted on top, so the named
# volume inherits those permissions and the app can write to it.
RUN mkdir -p Data/Database Data/Attachments && chown -R $APP_UID Data

# Overrides Kestrel:Endpoints:Http:Url (appsettings.json ships with
# "localhost:5000", which doesn't accept external connections inside a
# container) to listen on all interfaces on the standard .NET container port.
ENV ASPNETCORE_ENVIRONMENT=Production
ENV Kestrel__Endpoints__Http__Url=http://+:8080

EXPOSE 8080

USER $APP_UID
ENTRYPOINT ["dotnet", "Argyon.dll"]
