-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('LEAD', 'VIEWING', 'RESERVED', 'SIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('SHORT_TERM', 'YEARLY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TxCategory" ADD VALUE 'DEAL_FUNDS_IN';
ALTER TYPE "TxCategory" ADD VALUE 'DEAL_FUNDS_OUT';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "dealId" TEXT;

-- CreateTable
CREATE TABLE "LeasingDeal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'LEAD',
    "contractType" "ContractType" NOT NULL DEFAULT 'YEARLY',
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "clientNationality" TEXT,
    "source" TEXT,
    "property" TEXT,
    "unitNo" TEXT,
    "area" TEXT,
    "unitType" TEXT,
    "landlordName" TEXT,
    "landlordPhone" TEXT,
    "moveIn" TIMESTAMP(3),
    "months" INTEGER,
    "rent" DOUBLE PRECISION,
    "cheques" INTEGER,
    "deposit" DOUBLE PRECISION,
    "fee" DOUBLE PRECISION,
    "agent" TEXT,
    "agentCommission" DOUBLE PRECISION,
    "brokerName" TEXT,
    "brokerCommission" DOUBLE PRECISION,
    "viewingAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeasingDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeasingDeal_orgId_status_idx" ON "LeasingDeal"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeasingDeal_orgId_number_key" ON "LeasingDeal"("orgId", "number");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "LeasingDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeasingDeal" ADD CONSTRAINT "LeasingDeal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

