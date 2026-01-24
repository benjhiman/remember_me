-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN "referenceNumber" TEXT;

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerBalanceSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'LedgerAccount';
ALTER TYPE "AuditEntityType" ADD VALUE 'LedgerCategory';

-- CreateIndex
CREATE INDEX "LedgerAccount_organizationId_type_idx" ON "LedgerAccount"("organizationId", "type");

-- CreateIndex
CREATE INDEX "LedgerAccount_organizationId_isActive_idx" ON "LedgerAccount"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_organizationId_code_key" ON "LedgerAccount"("organizationId", "code");

-- CreateIndex
CREATE INDEX "LedgerCategory_organizationId_name_idx" ON "LedgerCategory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "CustomerBalanceSnapshot_organizationId_customerId_idx" ON "CustomerBalanceSnapshot"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "CustomerBalanceSnapshot_organizationId_asOfDate_idx" ON "CustomerBalanceSnapshot"("organizationId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerBalanceSnapshot_organizationId_customerId_asOfDate_key" ON "CustomerBalanceSnapshot"("organizationId", "customerId", "asOfDate");

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerCategory" ADD CONSTRAINT "LedgerCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBalanceSnapshot" ADD CONSTRAINT "CustomerBalanceSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBalanceSnapshot" ADD CONSTRAINT "CustomerBalanceSnapshot_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
