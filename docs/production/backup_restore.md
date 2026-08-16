# MedDentist Production Backup & Restore Guide

## 1. Overview
This document describes the operational backup, point-in-time recovery (PITR), encryption, and disaster recovery procedures for the MedDentist multi-tenant PostgreSQL database infrastructure.

---

## 2. Backup Strategy & Objectives
- **Target RPO (Recovery Point Objective)**: < 15 minutes.
- **Target RTO (Recovery Time Objective)**: < 1 hour.
- **Retention Period**: 30 days for daily full backups; 7 days for WAL archive logs.
- **Encryption Requirement**: All backups must be encrypted at rest using AES-256 before storage on external backup media or object storage.

---

## 3. Daily Automated Backup Procedure

### Full Database Custom-Format Backup
Execute daily at 02:00 UTC using `pg_dump`:

```bash
# Export compressed custom format database dump
pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER -F c -b -v -f "/backups/meddentist_$(date +%Y%m%d_%H%M%S).dump" $POSTGRES_DB

# Encrypt backup archive using AES-256
gpg --symmetric --cipher-algo AES256 --batch --passphrase-file /etc/backup/passphrase.key "/backups/meddentist_$(date +%Y%m%d_%H%M%S).dump"
```

### Continuous Archiving (WAL Streaming)
Configure `archive_command` in `postgresql.conf` for continuous Write-Ahead Log (WAL) archiving to support Point-in-Time Recovery:

```ini
wal_level = replica
archive_mode = on
archive_command = 'wal-g wal-push %p'
```

---

## 4. Disaster Recovery & Restore Procedure

### Step-by-Step Restore Instructions

1. **Provision Clean Database Server**:
   Ensure target PostgreSQL instance matches production version (PostgreSQL 17.x).

2. **Decrypt Backup Dump**:
   ```bash
   gpg --decrypt --batch --passphrase-file /etc/backup/passphrase.key -o /tmp/restored.dump /backups/meddentist_20260816_020000.dump.gpg
   ```

3. **Restore Custom-Format Archive**:
   ```bash
   pg_restore -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -v --clean --if-exists /tmp/restored.dump
   ```

4. **Verify Database Integrity**:
   Run schema check and migration verification:
   ```bash
   dotnet ef database update --project src/DentalClinic.Infrastructure --startup-project src/DentalClinic.Api
   ```

---

## 5. Automated Restore Verification Protocol
- Quarterly dry-run restore tests are conducted on an isolated staging environment.
- Test script restores daily dump onto temporary container, verifies foreign key integrity (`ANALYZE VERBOSE`), and runs full integration test suite against restored instance.
