-- Rent changes on a tenancy, each from a given month
ALTER TABLE "Lease" ADD COLUMN "rentChanges" JSONB;
