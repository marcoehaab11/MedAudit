FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Directory.Build.props", "."]
COPY ["NuGet.Config", "."]
COPY ["src/DentalClinic.Domain/DentalClinic.Domain.csproj", "src/DentalClinic.Domain/"]
COPY ["src/DentalClinic.Application/DentalClinic.Application.csproj", "src/DentalClinic.Application/"]
COPY ["src/DentalClinic.Infrastructure/DentalClinic.Infrastructure.csproj", "src/DentalClinic.Infrastructure/"]
COPY ["src/DentalClinic.PlatformAdmin/DentalClinic.PlatformAdmin.csproj", "src/DentalClinic.PlatformAdmin/"]
RUN dotnet restore src/DentalClinic.PlatformAdmin/DentalClinic.PlatformAdmin.csproj --configfile NuGet.Config
COPY src src
RUN dotnet publish src/DentalClinic.PlatformAdmin/DentalClinic.PlatformAdmin.csproj -c Release --no-restore -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
USER $APP_UID
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "DentalClinic.PlatformAdmin.dll"]
