import prisma from "../config/prisma.config.js";

async function main() {
  console.log("🚀 Initializing workday configurations for all companies...");

  try {
    // Get all companies
    const companies = await prisma.company.findMany({
      select: { id: true, companyName: true },
    });

    console.log(`📊 Found ${companies.length} companies`);

    // Check existing configs
    const existingConfigs = await prisma.workdayDaysConfig.findMany({
      select: { companyId: true },
    });

    const existingCompanyIds = new Set(existingConfigs.map((c) => c.companyId));
    const companiesNeedingConfig = companies.filter(
      (c) => !existingCompanyIds.has(c.id)
    );

    if (companiesNeedingConfig.length === 0) {
      console.log("✅ All companies already have workday configurations");
      return;
    }

    // Create default configs (Monday-Friday)
    const configs = companiesNeedingConfig.map((company) => ({
      companyId: company.id,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    }));

    const result = await prisma.workdayDaysConfig.createMany({
      data: configs,
      skipDuplicates: true,
    });

    console.log(`✅ Created ${result.count} workday configurations`);
    console.log("📅 Default: Monday to Friday");

    companiesNeedingConfig.forEach((company) => {
      console.log(`   • ${company.companyName}`);
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
