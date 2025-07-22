/*
  Warnings:

  - You are about to drop the column `startDate` on the `Employee` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "profilePic" TEXT,
    "password" TEXT NOT NULL,
    "position" TEXT,
    "departmentId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "avatar" TEXT,
    "role" TEXT NOT NULL,
    "dateOfBirth" DATETIME,
    "address" TEXT,
    "emergencyContact" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
    "salary" REAL,
    "lastLogin" DATETIME,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" DATETIME,
    "qrSecret" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("address", "avatar", "companyId", "createdAt", "dateOfBirth", "departmentId", "email", "emergencyContact", "employmentType", "id", "lastLogin", "location", "name", "password", "phone", "position", "profilePic", "qrSecret", "resetPasswordExpires", "resetPasswordToken", "role", "salary", "status") SELECT "address", "avatar", "companyId", "createdAt", "dateOfBirth", "departmentId", "email", "emergencyContact", "employmentType", "id", "lastLogin", "location", "name", "password", "phone", "position", "profilePic", "qrSecret", "resetPasswordExpires", "resetPasswordToken", "role", "salary", "status" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
