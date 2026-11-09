START TRANSACTION;
ALTER TABLE treatments ADD "ExecutedStepsJson" jsonb NOT NULL DEFAULT '[]';

ALTER TABLE implant_records ADD "ExecutedStepsJson" jsonb NOT NULL DEFAULT '[]';

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261109184532_PatientExecutedClinicalSteps', '10.0.11');

COMMIT;
