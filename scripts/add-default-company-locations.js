import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Configuration
const DRY_RUN = process.env.DRY_RUN === "true"; 
const DEFAULT_LATITUDE = 0.0; 
const DEFAULT_LONGITUDE = 0.0;

async function addDefaultCompanyLocations() {
  console.log("🚀 Starting Company Location Migration...");
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN (no changes will be made)" : "LIVE EXECUTION"}`
  );
  console.log("");

  try {
    // Step 1: Find all companies
    const allCompanies = await prisma.company.findMany({
      select: {
        id: true,
        companyName: true,
        locations: {
          select: { id: true },
        },
      },
    });

    console.log(`📊 Found ${allCompanies.length} total companies`);

    // Step 2: Identify companies without locations
    const companiesWithoutLocations = allCompanies.filter(
      (company) => company.locations.length === 0
    );

    console.log(
      `⚠️  Companies without locations: ${companiesWithoutLocations.length}`
    );

    if (companiesWithoutLocations.length === 0) {
      console.log("✅ All companies already have locations!");
      return;
    }

    // Step 3: Display what will be created
    console.log("\n📝 Companies that will get default locations:");
    companiesWithoutLocations.forEach((company) => {
      console.log(`   - ${company.companyName} (ID: ${company.id})`);
    });

    console.log("\n📍 Default location values:");
    console.log(`   - Latitude: ${DEFAULT_LATITUDE}`);
    console.log(`   - Longitude: ${DEFAULT_LONGITUDE}`);
    console.log(`   - Name: "Main Office"`);

    if (DRY_RUN) {
      console.log("\n🔍 DRY RUN COMPLETE - No changes made");
      console.log(
        "To execute for real, run: DRY_RUN=false node scripts/add-default-company-locations.js"
      );
      return;
    }

    // Step 4: Confirm execution
    console.log("\n⚠️  ABOUT TO CREATE LOCATIONS IN PRODUCTION!");
    console.log("Press Ctrl+C to cancel, or wait 10 seconds to continue...");

    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Step 5: Create default locations
    console.log("\n🔄 Creating default locations...");

    const createdLocations = [];

    for (const company of companiesWithoutLocations) {
      try {
        const location = await prisma.companyLocation.create({
          data: {
            companyId: company.id,
            name: "Main Office",
            latitude: DEFAULT_LATITUDE,
            longitude: DEFAULT_LONGITUDE,
            isActive: true,
          },
        });

        createdLocations.push(location);
        console.log(
          `✅ Created location for ${company.companyName}: ${location.id}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to create location for ${company.companyName}:`,
          error.message
        );
      }
    }

    // Step 6: Summary
    console.log("\n🎉 MIGRATION COMPLETE!");
    console.log(`Created ${createdLocations.length} default locations`);

    // Step 7: Verify
    const verification = await prisma.company.findMany({
      select: {
        id: true,
        companyName: true,
        locations: {
          select: { id: true, name: true, latitude: true, longitude: true },
        },
      },
    });

    console.log("\n🔍 Verification - Companies with locations:");
    verification.forEach((company) => {
      console.log(
        `   - ${company.companyName}: ${company.locations.length} location(s)`
      );
      company.locations.forEach((loc) => {
        console.log(`     * ${loc.name}: ${loc.latitude}, ${loc.longitude}`);
      });
    });
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle command line arguments
if (process.argv.includes("--dry-run") || process.argv.includes("--dryrun")) {
  process.env.DRY_RUN = "true";
}

// Run the migration
addDefaultCompanyLocations().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
