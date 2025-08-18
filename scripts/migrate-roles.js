import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

/**
 * Role Migration Script
 *
 * Maps old roles to new role system:
 * - HR, CEO → ADMIN
 * - DIRECTOR, CTO, MANAGEMENT → MANAGER
 * - EMPLOYEE → STAFF
 */

// Since the schema now only accepts STAFF, MANAGER, ADMIN,
// we need to use raw SQL to update roles that don't match the current enum
const ROLE_MAPPING = {
  HR: "ADMIN",
  CEO: "ADMIN",
  DIRECTOR: "MANAGER",
  CTO: "MANAGER",
  MANAGEMENT: "MANAGER",
  EMPLOYEE: "STAFF",
};

async function migrateRoles() {
  console.log("🚀 Starting role migration...");

  try {
    // First, get all current roles and their counts using raw SQL
    console.log("\n📊 Current role distribution:");
    const currentRoles = await prisma.$queryRaw`
      SELECT role, COUNT(*) as count 
      FROM "Employee" 
      GROUP BY role 
      ORDER BY role
    `;

    currentRoles.forEach((roleGroup) => {
      console.log(`  ${roleGroup.role}: ${roleGroup.count} employees`);
    });

    console.log("\n🔄 Beginning migration...");

    // Track migration results
    const migrationResults = {};

    // Migrate each role mapping using raw SQL to handle invalid enum values
    for (const [oldRole, newRole] of Object.entries(ROLE_MAPPING)) {
      console.log(`\n  Migrating ${oldRole} → ${newRole}...`);

      // Use raw SQL update to handle enum constraint issues
      const result = await prisma.$executeRaw`
        UPDATE "Employee" 
        SET role = ${newRole}::"Role" 
        WHERE role::text = ${oldRole}
      `;

      migrationResults[oldRole] = {
        newRole,
        count: result,
      };

      console.log(
        `    ✅ Updated ${result} employees from ${oldRole} to ${newRole}`
      );
    }

    // Verify final distribution
    console.log("\n📊 Final role distribution:");
    const finalRoles = await prisma.$queryRaw`
      SELECT role, COUNT(*) as count 
      FROM "Employee" 
      GROUP BY role 
      ORDER BY role
    `;

    finalRoles.forEach((roleGroup) => {
      console.log(`  ${roleGroup.role}: ${roleGroup.count} employees`);
    });

    // Summary
    console.log("\n📋 Migration Summary:");
    Object.entries(migrationResults).forEach(([oldRole, data]) => {
      if (data.count > 0) {
        console.log(
          `  ✅ ${oldRole} → ${data.newRole}: ${data.count} employees migrated`
        );
      }
    });

    console.log("\n🎉 Role migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Add dry-run functionality
async function dryRunMigration() {
  console.log("🔍 DRY RUN - No changes will be made");
  console.log("=======================================");

  try {
    console.log("\n📊 Current role distribution:");
    // Use raw SQL to get all roles, including invalid ones
    const currentRoles = await prisma.$queryRaw`
      SELECT role, COUNT(*) as count 
      FROM "Employee" 
      GROUP BY role 
      ORDER BY role
    `;

    currentRoles.forEach((roleGroup) => {
      console.log(`  ${roleGroup.role}: ${roleGroup.count} employees`);
    });

    console.log("\n🔄 Planned migrations:");

    for (const [oldRole, newRole] of Object.entries(ROLE_MAPPING)) {
      // Use raw SQL to count employees with old roles, casting text to enum
      const result = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM "Employee" 
        WHERE role::text = ${oldRole}
      `;

      const count = parseInt(result[0]?.count || 0);

      if (count > 0) {
        console.log(
          `  ${oldRole} → ${newRole}: ${count} employees would be updated`
        );
      }
    }

    console.log(
      "\n💡 To execute the migration, run: node migrate-roles.js --execute"
    );
  } catch (error) {
    console.error("❌ Dry run failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const shouldExecute = args.includes("--execute");

  if (shouldExecute) {
    await migrateRoles();
  } else {
    await dryRunMigration();
  }
}

// Run the migration
main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
