-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED');

-- AlterTable (add conversationId to MessageLog)
ALTER TABLE "MessageLog" ADD COLUMN "conversationId" TEXT;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalThreadId" TEXT,
    "phone" TEXT,
    "handle" TEXT,
    "leadId" TEXT,
    "assignedToId" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTagLink" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationTagLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageLog_conversationId_idx" ON "MessageLog"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_organizationId_provider_phone_key" ON "Conversation"("organizationId", "provider", "phone");

-- CreateIndex
CREATE INDEX "Conversation_organizationId_provider_lastMessageAt_idx" ON "Conversation"("organizationId", "provider", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_organizationId_assignedToId_idx" ON "Conversation"("organizationId", "assignedToId");

-- CreateIndex
CREATE INDEX "Conversation_organizationId_status_idx" ON "Conversation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Conversation_organizationId_provider_status_idx" ON "Conversation"("organizationId", "provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationTag_organizationId_name_key" ON "ConversationTag"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ConversationTag_organizationId_deletedAt_idx" ON "ConversationTag"("organizationId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationTagLink_conversationId_tagId_key" ON "ConversationTagLink"("conversationId", "tagId");

-- CreateIndex
CREATE INDEX "ConversationTagLink_conversationId_idx" ON "ConversationTagLink"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationTagLink_tagId_idx" ON "ConversationTagLink"("tagId");

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTag" ADD CONSTRAINT "ConversationTag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTagLink" ADD CONSTRAINT "ConversationTagLink_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTagLink" ADD CONSTRAINT "ConversationTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ConversationTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
