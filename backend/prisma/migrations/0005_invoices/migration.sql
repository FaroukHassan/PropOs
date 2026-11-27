
-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('SALES', 'PURCHASE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('COMPANY', 'TENANT', 'GUEST', 'LANDLORD', 'SUPPLIER', 'OTHER');

-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "trn" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "invoiceId" TEXT;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL DEFAULT 'SALES',
    "number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "partyType" "PartyType" NOT NULL DEFAULT 'COMPANY',
    "partyName" TEXT NOT NULL,
    "partyTrn" TEXT,
    "partyAddress" TEXT,
    "partyEmail" TEXT,
    "partyPhone" TEXT,
    "tenantId" TEXT,
    "landlordId" TEXT,
    "dealId" TEXT,
    "unitId" TEXT,
    "supplierRef" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "lines" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "vat" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "category" "TxCategory",
    "notes" TEXT,
    "scan" BYTEA,
    "scanName" TEXT,
    "scanMime" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_orgId_kind_issueDate_idx" ON "Invoice"("orgId", "kind", "issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orgId_number_key" ON "Invoice"("orgId", "number");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

