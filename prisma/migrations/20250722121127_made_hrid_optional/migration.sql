-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyName" TEXT NOT NULL,
    "companyEmail" TEXT NOT NULL,
    "companyTin" TEXT NOT NULL,
    "companyAddress" TEXT NOT NULL,
    "hrId" INTEGER,
    "companyDescription" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Company_hrId_fkey" FOREIGN KEY ("hrId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Company" ("companyAddress", "companyDescription", "companyEmail", "companyName", "companyTin", "createdAt", "hrId", "id") SELECT "companyAddress", "companyDescription", "companyEmail", "companyName", "companyTin", "createdAt", "hrId", "id" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE UNIQUE INDEX "Company_companyEmail_key" ON "Company"("companyEmail");
CREATE UNIQUE INDEX "Company_companyTin_key" ON "Company"("companyTin");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
