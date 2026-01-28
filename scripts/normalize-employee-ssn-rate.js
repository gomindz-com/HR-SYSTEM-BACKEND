import prisma from "../config/prisma.config.js";

/**
 * One-time script to normalize EmployeePayrollProfile.socialSecurityRate
 * so that all profiles use a 5% employee social security rate.
 *
 * This script:
 *  - Finds all EmployeePayrollProfile rows where socialSecurityRate != 0.05
 *  - Logs them for audit purposes
 *  - Updates their socialSecurityRate to 0.05
 *
 * Usage:
 *   node scripts/normalize-employee-ssn-rate.js
 */

const TARGET_RATE = 0.05;

const normalizeEmployeeSocialSecurityRate = async () => {
  try {
    console.log("🔍 Finding payroll profiles with non-standard social security rate...");

    // Find all profiles where the rate is not equal to the target rate
    const profilesToUpdate = await prisma.employeePayrollProfile.findMany({
      where: {
        OR: [
          {
            socialSecurityRate: {
              not: TARGET_RATE,
            },
          },
          {
            socialSecurityRate: null,
          },
        ],
      },
      select: {
        id: true,
        employeeId: true,
        socialSecurityRate: true,
        Employee: {
          select: {
            name: true,
            companyId: true,
            company: {
              select: {
                companyName: true,
              },
            },
          },
        },
      },
    });

    if (profilesToUpdate.length === 0) {
      console.log("✅ All payroll profiles already use the standard 5% rate.");
      return;
    }

    console.log(
      `📝 Found ${profilesToUpdate.length} profiles with non-standard social security rate (logging before update):`
    );
    profilesToUpdate.forEach((profile) => {
      const employeeName = profile.Employee?.name ?? "Unknown";
      const companyName = profile.Employee?.company?.companyName ?? "Unknown Company";
      console.log(
        `   - Profile ID: ${profile.id}, Employee: ${employeeName}, Company: ${companyName}, ` +
        `Old Rate: ${profile.socialSecurityRate}`
      );
    });

    console.log("\n🚀 Updating profiles to use 5% social security rate...\n");

    const updatePromises = profilesToUpdate.map((profile) =>
      prisma.employeePayrollProfile.update({
        where: { id: profile.id },
        data: {
          socialSecurityRate: TARGET_RATE,
        },
      })
    );

    await Promise.all(updatePromises);

    console.log(
      `🎉 Successfully normalized ${profilesToUpdate.length} payroll profiles to a 5% social security rate.`
    );
  } catch (error) {
    console.error("❌ Error normalizing social security rates:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

// Run the script
normalizeEmployeeSocialSecurityRate().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});

