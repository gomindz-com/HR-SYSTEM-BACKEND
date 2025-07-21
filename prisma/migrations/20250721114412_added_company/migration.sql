-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyName" TEXT NOT NULL,
    "companyEmail" TEXT NOT NULL,
    "companyTin" TEXT NOT NULL,
    "companyAddress" TEXT NOT NULL,
    "hrId" INTEGER NOT NULL,
    CONSTRAINT "Company_hrId_fkey" FOREIGN KEY ("hrId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_companyEmail_key" ON "Company"("companyEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Company_companyTin_key" ON "Company"("companyTin");
