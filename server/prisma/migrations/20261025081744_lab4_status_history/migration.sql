-- Lab 4, part 2: append-only status history (BR-20).
-- BR-33: only adds a table. Legacy tickets have no history rows (BR-35); their
-- history starts with their first Lab 4 status change.

-- CreateTable
CREATE TABLE "TicketStatusChange" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "fromStatus" "TicketStatus" NOT NULL,
    "toStatus" "TicketStatus" NOT NULL,
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketStatusChange_ticketId_changedAt_idx" ON "TicketStatusChange"("ticketId", "changedAt");

-- AddForeignKey
ALTER TABLE "TicketStatusChange" ADD CONSTRAINT "TicketStatusChange_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusChange" ADD CONSTRAINT "TicketStatusChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
