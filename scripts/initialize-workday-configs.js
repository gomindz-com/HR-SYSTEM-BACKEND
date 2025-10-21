import prisma from "../config/prisma.config.js";

/**
 * Initialize default workday configurations for all existing companies
 * This script creates WorkdayDaysConfig records for companies that don't have them yet
 */
async function initializeWorkdayConfigs() {
  console.log("🚀 Starting workday configuration initialization...");

  try {
    // Get all companies
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        companyName: true,
      },
    });

    console.log(`📊 Found ${companies.length} companies to process`);

    if (companies.length === 0) {
      console.log("⚠️  No companies found. Nothing to initialize.");
      return;
    }

    // Check which companies already have workday configurations
    const existingConfigs = await prisma.workdayDaysConfig.findMany({
      select: {
        companyId: true,
      },
    });

    const existingCompanyIds = new Set(
      existingConfigs.map((config) => config.companyId)
    );

    // Filter companies that don't have workday configurations
    const companiesNeedingConfig = companies.filter(
      (company) => !existingCompanyIds.has(company.id)
    );

    console.log(
      `📋 ${existingConfigs.length} companies already have workday configurations`
    );
    console.log(
      `🆕 ${companiesNeedingConfig.length} companies need workday configurations`
    );

    if (companiesNeedingConfig.length === 0) {
      console.log(
        "✅ All companies already have workday configurations. Nothing to do."
      );
      return;
    }

    // Create default workday configurations
    const defaultWorkdayConfigs = companiesNeedingConfig.map((company) => ({
      companyId: company.id,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    }));

    console.log("📝 Creating default workday configurations...");

    // Use createMany for bulk insertion
    const result = await prisma.workdayDaysConfig.createMany({
      data: defaultWorkdayConfigs,
      skipDuplicates: true, // Skip if somehow duplicates exist
    });

    console.log(
      `✅ Successfully created ${result.count} workday configurations`
    );

    // Log details for each company
    console.log("\n📋 Companies that received default workday configurations:");
    companiesNeedingConfig.forEach((company) => {
      console.log(
        `   • ${company.companyName} (ID: ${company.id}) - Monday to Friday`
      );
    });

    console.log(
      "\n🎉 Workday configuration initialization completed successfully!"
    );
    console.log(
      "📅 Default configuration: Monday to Friday (9 AM - 5 PM pattern)"
    );
    console.log(
      "💡 Companies can now customize their workdays through the settings page"
    );
  } catch (error) {
    console.error("❌ Error initializing workday configurations:", error);
    throw error;
  }
}

/**
 * Verify the initialization was successful
 */
async function verifyWorkdayConfigs() {
  console.log("\n🔍 Verifying workday configurations...");

  try {
    const totalCompanies = await prisma.company.count();
    const totalWorkdayConfigs = await prisma.workdayDaysConfig.count();

    console.log(`📊 Total companies: ${totalCompanies}`);
    console.log(`📊 Total workday configurations: ${totalWorkdayConfigs}`);

    if (totalCompanies === totalWorkdayConfigs) {
      console.log("✅ All companies have workday configurations!");
    } else {
      console.log(
        `⚠️  ${totalCompanies - totalWorkdayConfigs} companies are missing workday configurations`
      );
    }

    // Show sample configurations
    const sampleConfigs = await prisma.workdayDaysConfig.findMany({
      take: 3,
      include: {
        company: {
          select: {
            companyName: true,
          },
        },
      },
    });

    console.log("\n📋 Sample workday configurations:");
    sampleConfigs.forEach((config) => {
      const workdays = [];
      if (config.monday) workdays.push("Mon");
      if (config.tuesday) workdays.push("Tue");
      if (config.wednesday) workdays.push("Wed");
      if (config.thursday) workdays.push("Thu");
      if (config.friday) workdays.push("Fri");
      if (config.saturday) workdays.push("Sat");
      if (config.sunday) workdays.push("Sun");

      console.log(`   • ${config.company.companyName}: ${workdays.join(", ")}`);
    });
  } catch (error) {
    console.error("❌ Error verifying workday configurations:", error);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log("=".repeat(60));
  console.log("🏢 WORKDAY CONFIGURATION INITIALIZATION SCRIPT");
  console.log("=".repeat(60));

  try {
    await initializeWorkdayConfigs();
    await verifyWorkdayConfigs();

    console.log("\n" + "=".repeat(60));
    console.log("✅ SCRIPT COMPLETED SUCCESSFULLY");
    console.log("=".repeat(60));
  } catch (error) {
    console.log("\n" + "=".repeat(60));
    console.log("❌ SCRIPT FAILED");
    console.log("=".repeat(60));
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    // Close the database connection
    await prisma.$disconnect();
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { initializeWorkdayConfigs, verifyWorkdayConfigs };
