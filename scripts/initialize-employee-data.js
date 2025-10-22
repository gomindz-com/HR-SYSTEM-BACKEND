import prisma from "../config/prisma.config.js";

/**
 * Initialize missing employee data (payroll profiles and benefits)
 * This script ensures all employees have the required data structures
 *
 * Usage: node scripts/initialize-employee-data.js
 */

const initializeEmployeeData = async () => {
  try {
    console.log("🔍 Checking employee data initialization...");

    // Find all active employees
    const employees = await prisma.employee.findMany({
      where: {
        deleted: false,
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
        EmployeePayrollProfile: true,
        EmployeeBenefit: true,
      },
    });

    if (employees.length === 0) {
      console.log("✅ No employees found!");
      return;
    }

    console.log(`📝 Found ${employees.length} employees to check:`);

    let payrollProfilesCreated = 0;
    let benefitsCreated = 0;

    // Process each employee
    for (const employee of employees) {
      console.log(
        `\n👤 Processing: ${employee.name} (${employee.company.companyName})`
      );

      // Check and create payroll profile if missing
      if (!employee.EmployeePayrollProfile) {
        const profile = await prisma.employeePayrollProfile.create({
          data: {
            id: `profile_${employee.id}_${Date.now()}`,
            employeeId: employee.id,
            taxBracket: null,
            socialSecurityRate: 0,
            customTaxRate: null,
            updatedAt: new Date(),
          },
        });
        console.log(`   ✅ Created payroll profile (ID: ${profile.id})`);
        payrollProfilesCreated++;
      } else {
        console.log(`   ✅ Payroll profile already exists`);
      }

      // Check if employee has any benefits
      if (employee.EmployeeBenefit.length === 0) {
        // Create a default "OTHER" benefit with 0 amount (inactive)
        const benefit = await prisma.employeeBenefit.create({
          data: {
            id: `benefit_${employee.id}_${Date.now()}`,
            employeeId: employee.id,
            companyId: employee.companyId,
            benefitType: "OTHER",
            amount: 0,
            isActive: false, // Inactive by default
            updatedAt: new Date(),
          },
        });
        console.log(`   ✅ Created default benefit (ID: ${benefit.id})`);
        benefitsCreated++;
      } else {
        console.log(
          `   ✅ Benefits already exist (${employee.EmployeeBenefit.length} records)`
        );
      }
    }

    console.log("\n🎉 Initialization Summary:");
    console.log(`   📊 Employees processed: ${employees.length}`);
    console.log(`   💼 Payroll profiles created: ${payrollProfilesCreated}`);
    console.log(`   🎁 Benefits created: ${benefitsCreated}`);

    if (payrollProfilesCreated > 0 || benefitsCreated > 0) {
      console.log("\n💡 All employees now have the required data structures.");
      console.log("   Benefits and tax pages should work without crashes!");
    } else {
      console.log(
        "\n✅ All employees already had the required data structures."
      );
    }
  } catch (error) {
    console.error("❌ Error initializing employee data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

// Run the script
initializeEmployeeData().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
