-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyName" TEXT NOT NULL,
    "companyEmail" TEXT NOT NULL,
    "companyTin" TEXT NOT NULL,
    "companyAddress" TEXT NOT NULL,
    "hrId" INTEGER NOT NULL,
    "companyDescription" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Company_hrId_fkey" FOREIGN KEY ("hrId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Company" ("companyAddress", "companyDescription", "companyEmail", "companyName", "companyTin", "hrId", "id") SELECT "companyAddress", "companyDescription", "companyEmail", "companyName", "companyTin", "hrId", "id" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE UNIQUE INDEX "Company_companyEmail_key" ON "Company"("companyEmail");
CREATE UNIQUE INDEX "Company_companyTin_key" ON "Company"("companyTin");
CREATE TABLE "new_Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "managerId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Department" ("description", "id", "managerId", "name") SELECT "description", "id", "managerId", "name" FROM "Department";
DROP TABLE "Department";
ALTER TABLE "new_Department" RENAME TO "Department";
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
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
    "startDate" DATETIME NOT NULL,
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
INSERT INTO "new_Employee" ("address", "avatar", "companyId", "dateOfBirth", "departmentId", "email", "emergencyContact", "employmentType", "id", "lastLogin", "location", "name", "password", "phone", "position", "profilePic", "qrSecret", "resetPasswordExpires", "resetPasswordToken", "role", "salary", "startDate", "status") SELECT "address", "avatar", "companyId", "dateOfBirth", "departmentId", "email", "emergencyContact", "employmentType", "id", "lastLogin", "location", "name", "password", "phone", "position", "profilePic", "qrSecret", "resetPasswordExpires", "resetPasswordToken", "role", "salary", "startDate", "status" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
CREATE TABLE "new_LeaveRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "appliedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approverId" INTEGER,
    "comments" TEXT,
    "attachmentUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeaveRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeaveRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LeaveRequest" ("appliedDate", "approverId", "attachmentUrl", "comments", "companyId", "days", "employeeId", "endDate", "id", "leaveType", "reason", "startDate", "status") SELECT "appliedDate", "approverId", "attachmentUrl", "comments", "companyId", "days", "employeeId", "endDate", "id", "leaveType", "reason", "startDate", "status" FROM "LeaveRequest";
DROP TABLE "LeaveRequest";
ALTER TABLE "new_LeaveRequest" RENAME TO "LeaveRequest";
CREATE TABLE "new_Payroll" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "baseSalary" REAL NOT NULL,
    "bonuses" REAL,
    "deductions" REAL,
    "taxes" REAL,
    "netPay" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processedDate" DATETIME,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payroll_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Payroll" ("baseSalary", "bonuses", "companyId", "deductions", "employeeId", "id", "netPay", "notes", "paymentMethod", "periodEnd", "periodStart", "processedDate", "status", "taxes") SELECT "baseSalary", "bonuses", "companyId", "deductions", "employeeId", "id", "netPay", "notes", "paymentMethod", "periodEnd", "periodStart", "processedDate", "status", "taxes" FROM "Payroll";
DROP TABLE "Payroll";
ALTER TABLE "new_Payroll" RENAME TO "Payroll";
CREATE TABLE "new_PerformanceReview" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "score" REAL NOT NULL,
    "rating" REAL NOT NULL,
    "comments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerformanceReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PerformanceReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PerformanceReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PerformanceReview" ("comments", "companyId", "employeeId", "id", "periodEnd", "periodStart", "rating", "reviewerId", "score", "status") SELECT "comments", "companyId", "employeeId", "id", "periodEnd", "periodStart", "rating", "reviewerId", "score", "status" FROM "PerformanceReview";
DROP TABLE "PerformanceReview";
ALTER TABLE "new_PerformanceReview" RENAME TO "PerformanceReview";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
