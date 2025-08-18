-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_departmentId_fkey";

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "companyEmail" DROP NOT NULL,
ALTER COLUMN "companyTin" DROP NOT NULL,
ALTER COLUMN "companyAddress" DROP NOT NULL,
ALTER COLUMN "companyDescription" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "departmentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
