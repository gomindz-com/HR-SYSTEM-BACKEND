/*
  Warnings:

  - The values [OTHER] on the enum `LeaveType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `appliedDate` on the `LeaveRequest` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentUrl` on the `LeaveRequest` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `LeaveRequest` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `LeaveRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LeaveType_new" AS ENUM ('STUDY', 'MATERNITY', 'SICK', 'VACATION', 'ANNUAL', 'PERSONAL');
ALTER TABLE "LeaveRequest" ALTER COLUMN "leaveType" TYPE "LeaveType_new" USING ("leaveType"::text::"LeaveType_new");
ALTER TYPE "LeaveType" RENAME TO "LeaveType_old";
ALTER TYPE "LeaveType_new" RENAME TO "LeaveType";
DROP TYPE "LeaveType_old";
COMMIT;

-- AlterTable
ALTER TABLE "LeaveRequest" DROP COLUMN "appliedDate",
DROP COLUMN "attachmentUrl",
DROP COLUMN "reason",
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "attachmentUrls" JSONB,
ADD COLUMN     "isApproved" BOOLEAN,
ADD COLUMN     "rejectReason" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
