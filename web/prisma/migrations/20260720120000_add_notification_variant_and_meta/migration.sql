-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "variant" TEXT NOT NULL DEFAULT 'info';

ALTER TABLE "Notification"
ADD COLUMN "meta" JSONB;
