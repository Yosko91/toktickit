-- Lab 3, part 1: enum changes only.
-- Kept in its own migration because PostgreSQL will not let a value added by
-- ALTER TYPE be used inside the same transaction that added it, and Prisma runs
-- each migration file as one transaction.

-- BR-11: one role per user.
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- BR-21: the two statuses the IT Staff workflow needs. They are inserted at a
-- chosen position rather than appended, so the physical enum order still matches
-- the declared order in schema.prisma and ORDER BY on the column stays sensible.
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER' AFTER 'PENDING';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED' AFTER 'CLOSED';
