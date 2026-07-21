-- AlterTable
ALTER TABLE "User" ADD COLUMN     "level2GateUnlockMethod" TEXT,
ADD COLUMN     "level2GateUnlockedAt" TIMESTAMP(3);
