-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN     "status" "MessageStatus" DEFAULT 'QUEUED',
ADD COLUMN     "externalMessageId" TEXT,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_externalMessageId_key" ON "MessageLog"("externalMessageId") WHERE "externalMessageId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "MessageLog_externalMessageId_idx" ON "MessageLog"("externalMessageId");
