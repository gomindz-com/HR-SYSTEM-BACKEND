import prisma from "../config/prisma.config.js";

/**
 * Initialize EmployeePayrollProfile for existing employees
 * This script creates default payroll profiles for employees who don't have them
 *
 * Usage: node scripts/initialize-employee-payroll-profiles.js
 */

const initializeEmployeePayrollProfiles = async () => {
  try {
    console.log("🔍 Finding employees without payroll profiles...");

    // Find employees without EmployeePayrollProfile
    const employeesWithoutProfiles = await prisma.employee.findMany({
      where: {
        deleted: false,
        EmployeePayrollProfile: null,
      },
      select: {
        id: true,
        name: true,
        companyId: true,
        company: {
          select: {
            companyName: true,
          },
        },
      },
    });

    if (employeesWithoutProfiles.length === 0) {
      console.log("✅ All employees already have payroll profiles!");
      return;
    }

    console.log(
      `📝 Found ${employeesWithoutProfiles.length} employees without payroll profiles:`
    );
    employeesWithoutProfiles.forEach((employee) => {
      console.log(`   - ${employee.name} (${employee.company.companyName})`);
    });

    console.log("\n🚀 Creating default payroll profiles...\n");

    // Create default payroll profiles for each employee
    for (const employee of employeesWithoutProfiles) {
      const profile = await prisma.employeePayrollProfile.create({
        data: {
          id: `profile_${employee.id}_${Date.now()}`, // Generate unique ID
          employeeId: employee.id,
          taxBracket: null, // No default tax bracket
          socialSecurityRate: 0, // 0% default social security rate
          customTaxRate: null,
        },
      });

      console.log(
        `✅ Created payroll profile for: ${employee.name} (ID: ${profile.id})`
      );
    }

    console.log(
      `🎉 Successfully created ${employeesWithoutProfiles.length} payroll profiles!`
    );
    console.log(
      "💡 Employees can now access benefits and tax settings without errors."
    );
  } catch (error) {
    console.error("❌ Error initializing payroll profiles:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

// Run the script
initializeEmployeePayrollProfiles().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
