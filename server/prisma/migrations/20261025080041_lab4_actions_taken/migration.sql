-- Lab 4, part 1: Actions Taken, ticket version and resolvedAt.
-- BR-33: this migration only adds. No existing row is deleted, and the only
-- rows written are the backfill at the end.

-- BR-08
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- BR-21 and BR-22. The default 1 is the backfill for version (BR-35): every
-- existing ticket starts at version 1.
ALTER TABLE "Ticket" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- BR-01: ticketId is NOT NULL with a foreign key, so an action always belongs
-- to exactly one existing ticket.
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'COMPLETED',
    "performedById" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "clientRequestId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- BR-14: unique, so two retries arriving at the same moment cannot both insert.
CREATE UNIQUE INDEX "ActionTaken_clientRequestId_key" ON "ActionTaken"("clientRequestId");

-- Ticket Detail list (BR-15) and the My Open Actions metric (BR-28).
CREATE INDEX "ActionTaken_ticketId_actionAt_idx" ON "ActionTaken"("ticketId", "actionAt");
CREATE INDEX "ActionTaken_performedById_status_idx" ON "ActionTaken"("performedById", "status");

-- Recently updated lists on both dashboards.
CREATE INDEX "Ticket_updatedAt_idx" ON "Ticket"("updatedAt");

ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- BR-35 backfill: legacy resolved and closed tickets get the best time we
-- know for their resolution, which is their last update. Without it they would
-- never appear in "recently resolved" and would look different from new ones.
UPDATE "Ticket" SET "resolvedAt" = "updatedAt" WHERE "currentStatus" IN ('RESOLVED', 'CLOSED');
