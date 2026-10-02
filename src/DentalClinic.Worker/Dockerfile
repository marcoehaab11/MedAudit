# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Directory.Build.props", "."]
COPY ["NuGet.Config", "."]
COPY ["src/DentalClinic.Domain/DentalClinic.Domain.csproj", "src/DentalClinic.Domain/"]
COPY ["src/DentalClinic.Application/DentalClinic.Application.csproj", "src/DentalClinic.Application/"]
COPY ["src/DentalClinic.Infrastructure/DentalClinic.Infrastructure.csproj", "src/DentalClinic.Infrastructure/"]
COPY ["src/DentalClinic.Worker/DentalClinic.Worker.csproj", "src/DentalClinic.Worker/"]
RUN --mount=type=cache,target=/root/.nuget/packages,sharing=locked \
    dotnet restore src/DentalClinic.Worker/DentalClinic.Worker.csproj --configfile NuGet.Config
COPY src src
RUN --mount=type=cache,target=/root/.nuget/packages,sharing=locked \
    dotnet publish src/DentalClinic.Worker/DentalClinic.Worker.csproj -c Release -o /app/publish /p:UseAppHost=false --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
USER $APP_UID
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "DentalClinic.Worker.dll"]
