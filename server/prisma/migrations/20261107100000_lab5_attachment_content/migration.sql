-- Lab 5 (R-04): attachment bytes are stored in PostgreSQL. Additive only.
CREATE TABLE "AttachmentContent" (
    "attachmentId" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "AttachmentContent_pkey" PRIMARY KEY ("attachmentId")
);

ALTER TABLE "AttachmentContent" ADD CONSTRAINT "AttachmentContent_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
