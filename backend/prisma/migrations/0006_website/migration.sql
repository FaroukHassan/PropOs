
-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "airbnbUrl" TEXT,
ADD COLUMN     "bookingUrl" TEXT,
ADD COLUMN     "onWebsite" BOOLEAN NOT NULL DEFAULT true;

