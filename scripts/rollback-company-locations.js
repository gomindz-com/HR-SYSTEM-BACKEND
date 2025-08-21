const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Configuration
const DRY_RUN = process.env.DRY_RUN === "true";
const LOCATION_NAME_TO_REMOVE = "Main Office"; // Only remove locations with this name

async function rollbackCompanyLocations() {
  console.log("🔄 Starting Company Location Rollback...");
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN (no changes will be made)" : "LIVE EXECUTION"}`
  );
  console.log(`Target: Locations named "${LOCATION_NAME_TO_REMOVE}"`);
  console.log("");

  try {
    // Step 1: Find locations to remove
    const locationsToRemove = await prisma.companyLocation.findMany({
      where: {
        name: LOCATION_NAME_TO_REMOVE,
      },
      include: {
        company: {
          select: { companyName: true },
        },
      },
    });

    console.log(`📊 Found ${locationsToRemove.length} locations to remove`);

    if (locationsToRemove.length === 0) {
      console.log("✅ No locations found to remove!");
      return;
    }

    // Step 2: Display what will be removed
    console.log("\n📝 Locations that will be removed:");
    locationsToRemove.forEach((location) => {
      console.log(
        `   - ${location.company.companyName}: ${location.name} (ID: ${location.id})`
      );
    });

    if (DRY_RUN) {
      console.log("\n🔍 DRY RUN COMPLETE - No changes made");
      console.log(
        "To execute for real, run: DRY_RUN=false node scripts/rollback-company-locations.js"
      );
      return;
    }

    // Step 3: Confirm execution
    console.log("\n⚠️  ABOUT TO DELETE LOCATIONS IN PRODUCTION!");
    console.log("Press Ctrl+C to cancel, or wait 10 seconds to continue...");

    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Step 4: Delete locations
    console.log("\n🗑️  Removing locations...");

    let deletedCount = 0;

    for (const location of locationsToRemove) {
      try {
        await prisma.companyLocation.delete({
          where: { id: location.id },
        });

        deletedCount++;
        console.log(
          `✅ Removed location for ${location.company.companyName}: ${location.id}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to remove location for ${location.company.companyName}:`,
          error.message
        );
      }
    }

    // Step 5: Summary
    console.log("\n🎉 ROLLBACK COMPLETE!");
    console.log(`Removed ${deletedCount} locations`);
  } catch (error) {
    console.error("❌ Rollback failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle command line arguments
if (process.argv.includes("--dry-run") || process.argv.includes("--dryrun")) {
  process.env.DRY_RUN = "true";
}

// Run the rollback
rollbackCompanyLocations().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
