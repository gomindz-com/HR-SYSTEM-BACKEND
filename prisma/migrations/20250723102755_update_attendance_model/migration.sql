/*
  Warnings:

  - You are about to drop the column `approvedBy` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `overtimeHours` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `qrCheckIn` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `qrCheckOut` on the `Attendance` table. All the data in the column will be lost.
  - You are about to alter the column `timeIn` on the `Attendance` table. The data in that column could be lost. The data in that column will be cast from `String` to `DateTime`.
  - You are about to alter the column `timeOut` on the `Attendance` table. The data in that column could be lost. The data in that column will be cast from `String` to `DateTime`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "timeIn" DATETIME,
    "timeOut" DATETIME,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("companyId", "createdAt", "date", "employeeId", "id", "status", "timeIn", "timeOut", "updatedAt") SELECT "companyId", "createdAt", "date", "employeeId", "id", "status", "timeIn", "timeOut", "updatedAt" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
