-- CreateTable
CREATE TABLE "job_runner_lock" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lockedBy" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_runner_lock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runner_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastRunAt" TIMESTAMP(3),
    "lastRunDurationMs" INTEGER,
    "lastRunJobCount" INTEGER,
    "lastRunError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_runner_state_pkey" PRIMARY KEY ("id")
);

-- Insert initial state
INSERT INTO "job_runner_state" ("id", "createdAt", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
