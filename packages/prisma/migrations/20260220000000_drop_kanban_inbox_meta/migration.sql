-- Drop tables related to Kanban, Inbox, and Meta Ads

-- Drop Meta Ads tables first (they may have FKs)
DROP TABLE IF EXISTS "MetaSpendDaily" CASCADE;
DROP TABLE IF EXISTS "MetaAttributionSnapshot" CASCADE;

-- Drop Inbox/Conversation tables
DROP TABLE IF EXISTS "ConversationTagLink" CASCADE;
DROP TABLE IF EXISTS "ConversationTag" CASCADE;
DROP TABLE IF EXISTS "MessageLog" CASCADE;
DROP TABLE IF EXISTS "Conversation" CASCADE;
DROP TABLE IF EXISTS "WhatsAppTemplate" CASCADE;
DROP TABLE IF EXISTS "WhatsAppAutomationRule" CASCADE;

-- Drop Kanban tables (Pipeline and Stage)
DROP TABLE IF EXISTS "Stage" CASCADE;
DROP TABLE IF EXISTS "Pipeline" CASCADE;

-- Remove pipelineId and stageId from Lead table
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_pipelineId_fkey";
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_stageId_fkey";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "pipelineId";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "stageId";

-- Drop index that included pipelineId and stageId
DROP INDEX IF EXISTS "Lead_organizationId_pipelineId_stageId_idx";

-- Remove enums that are no longer used (only if they exist)
-- Note: PostgreSQL doesn't support DROP TYPE IF EXISTS directly, so we use DO block
DO $$ 
BEGIN
  -- Drop enums only if they exist and are not used elsewhere
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttributionSource') THEN
    DROP TYPE "AttributionSource" CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MetaSpendLevel') THEN
    DROP TYPE "MetaSpendLevel" CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationStatus') THEN
    DROP TYPE "ConversationStatus" CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageDirection') THEN
    DROP TYPE "MessageDirection" CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageStatus') THEN
    DROP TYPE "MessageStatus" CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsAppTemplateCategory') THEN
    DROP TYPE "WhatsAppTemplateCategory" CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsAppTemplateStatus') THEN
    DROP TYPE "WhatsAppTemplateStatus" CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsAppAutomationTrigger') THEN
    DROP TYPE "WhatsAppAutomationTrigger" CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsAppAutomationAction') THEN
    DROP TYPE "WhatsAppAutomationAction" CASCADE;
  END IF;
END $$;

-- Remove WHATSAPP and INSTAGRAM from IntegrationProvider enum
-- Keep FACEBOOK if it exists
DO $$
BEGIN
  -- Check if enum exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationProvider') THEN
    -- Remove WHATSAPP if it exists
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'WHATSAPP' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'IntegrationProvider')) THEN
      ALTER TYPE "IntegrationProvider" DROP VALUE IF EXISTS 'WHATSAPP';
    END IF;
    
    -- Remove INSTAGRAM if it exists
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'INSTAGRAM' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'IntegrationProvider')) THEN
      ALTER TYPE "IntegrationProvider" DROP VALUE IF EXISTS 'INSTAGRAM';
    END IF;
  END IF;
END $$;

-- Remove FETCH_META_SPEND and REFRESH_META_TOKEN from IntegrationJobType enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationJobType') THEN
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'FETCH_META_SPEND' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'IntegrationJobType')) THEN
      ALTER TYPE "IntegrationJobType" DROP VALUE IF EXISTS 'FETCH_META_SPEND';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'REFRESH_META_TOKEN' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'IntegrationJobType')) THEN
      ALTER TYPE "IntegrationJobType" DROP VALUE IF EXISTS 'REFRESH_META_TOKEN';
    END IF;
  END IF;
END $$;
