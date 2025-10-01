import prisma from "../config/prisma.config.js";

/**
 * Grant lifetime access to specific companies
 * Usage: node scripts/grant-lifetime-access.js companyId1 companyId2 ...
 */

const grantLifetimeAccess = async (companyIds) => {
  try {
    console.log(
      `🔓 Granting lifetime access to ${companyIds.length} companies...`
    );

    for (const companyId of companyIds) {
      const company = await prisma.company.update({
        where: { id: parseInt(companyId) },
        data: { hasLifetimeAccess: true },
        select: {
          id: true,
          companyName: true,
          hasLifetimeAccess: true,
        },
      });

      console.log(
        `✅ Granted lifetime access to: ${company.companyName} (ID: ${company.id})`
      );
    }

    console.log(
      `🎉 Lifetime access granted successfully to ${companyIds.length} companies!`
    );
  } catch (error) {
    console.error("❌ Error granting lifetime access:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

const revokeLifetimeAccess = async (companyIds) => {
  try {
    console.log(
      `🔒 Revoking lifetime access from ${companyIds.length} companies...`
    );

    for (const companyId of companyIds) {
      const company = await prisma.company.update({
        where: { id: parseInt(companyId) },
        data: { hasLifetimeAccess: false },
        select: {
          id: true,
          companyName: true,
          hasLifetimeAccess: true,
        },
      });

      console.log(
        `✅ Revoked lifetime access from: ${company.companyName} (ID: ${company.id})`
      );
    }

    console.log(
      `🎉 Lifetime access revoked successfully from ${companyIds.length} companies!`
    );
  } catch (error) {
    console.error("❌ Error revoking lifetime access:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

// Run from command line
const args = process.argv.slice(2);
const command = args[0];
const companyIds = args.slice(1);

if (!command || companyIds.length === 0) {
  console.log(`
Usage:
  Grant lifetime access:  node scripts/grant-lifetime-access.js grant companyId1 companyId2 ...
  Revoke lifetime access: node scripts/grant-lifetime-access.js revoke companyId1 companyId2 ...

Examples:
  node scripts/grant-lifetime-access.js grant 1 5 10
  node scripts/grant-lifetime-access.js revoke 1 5 10
  `);
  process.exit(1);
}

if (command === "grant") {
  grantLifetimeAccess(companyIds).catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
} else if (command === "revoke") {
  revokeLifetimeAccess(companyIds).catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
} else {
  console.error(`Unknown command: ${command}. Use 'grant' or 'revoke'.`);
  process.exit(1);
}
