import prisma from "../config/prisma.config.js";

async function updateCompanyTimezones() {
  try {
    console.log("🔄 Updating company timezones...");

    // Update existing companies with appropriate timezones
    // You can customize this based on your companies' actual locations

    const updates = [
      // Example: Update specific companies with their timezones
      // { id: 1, timezone: "Africa/Banjul" }, // Gambia
      // { id: 2, timezone: "Africa/Lagos" },  // Nigeria
      // { id: 3, timezone: "America/New_York" }, // USA
    ];

    for (const update of updates) {
      await prisma.company.update({
        where: { id: update.id },
        data: { timezone: update.timezone },
      });
      console.log(
        `✅ Updated company ${update.id} with timezone: ${update.timezone}`
      );
    }

    // List all companies and their current timezones
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        companyName: true,
        timezone: true,
      },
    });

    console.log("\n📋 Current company timezones:");
    companies.forEach((company) => {
      console.log(
        `  - Company ${company.id} (${company.companyName}): ${company.timezone}`
      );
    });

    console.log("\n✅ Company timezone update completed!");
  } catch (error) {
    console.error("❌ Error updating company timezones:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateCompanyTimezones();
