-- AlterTable: Add stockItemId to PurchaseLine
ALTER TABLE "PurchaseLine" ADD COLUMN "stockItemId" TEXT;

-- CreateTable: PurchaseStockApplication (idempotency)
CREATE TABLE "PurchaseStockApplication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedByUserId" TEXT NOT NULL,

    CONSTRAINT "PurchaseStockApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseStockApplication_purchaseId_key" ON "PurchaseStockApplication"("purchaseId");
CREATE INDEX "PurchaseStockApplication_organizationId_appliedAt_idx" ON "PurchaseStockApplication"("organizationId", "appliedAt");
CREATE INDEX "PurchaseStockApplication_purchaseId_idx" ON "PurchaseStockApplication"("purchaseId");
CREATE INDEX "PurchaseLine_stockItemId_idx" ON "PurchaseLine"("stockItemId");

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseStockApplication" ADD CONSTRAINT "PurchaseStockApplication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseStockApplication" ADD CONSTRAINT "PurchaseStockApplication_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseStockApplication" ADD CONSTRAINT "PurchaseStockApplication_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
