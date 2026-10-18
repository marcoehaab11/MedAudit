using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
#nullable disable
namespace DentalClinic.Infrastructure.Persistence.Migrations;
[DbContext(typeof(ApplicationDbContext))]
[Migration("20261018131000_ApproveCompletedVisitTreatmentPrice")]
public class ApproveCompletedVisitTreatmentPrice : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE OR REPLACE FUNCTION prevent_completed_treatment_mutation() RETURNS trigger AS $$
        BEGIN
            IF OLD."Status" = 4 THEN
                IF TG_OP = 'UPDATE' THEN
                    IF OLD."PriceConfirmed" = false AND NEW."PriceConfirmed" = true
                        AND (to_jsonb(NEW) - ARRAY['Price','PriceConfirmed','UpdatedAt','Version'])
                            IS NOT DISTINCT FROM (to_jsonb(OLD) - ARRAY['Price','PriceConfirmed','UpdatedAt','Version'])
                    THEN RETURN NEW; END IF;
                END IF;
                RAISE EXCEPTION 'Completed treatments are immutable' USING ERRCODE = '23514';
            END IF;
            RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
        END;
        $$ LANGUAGE plpgsql;
        """);
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE OR REPLACE FUNCTION prevent_completed_treatment_mutation() RETURNS trigger AS $$
        BEGIN
            IF OLD."Status" = 4 THEN RAISE EXCEPTION 'Completed treatments are immutable' USING ERRCODE = '23514'; END IF;
            RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
        END;
        $$ LANGUAGE plpgsql;
        """);
}
