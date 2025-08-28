-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING_SHIFT', 'AFTERNOON_SHIFT');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "workEndTime2" TEXT NOT NULL DEFAULT '00:00',
ADD COLUMN     "workStartTime2" TEXT NOT NULL DEFAULT '17:00';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "shiftType" "Shift";
