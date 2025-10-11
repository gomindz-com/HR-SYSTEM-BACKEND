import prisma from "../config/prisma.config.js";

/**
 * Auto-verify all existing users in the database
 * This is a one-time migration script to ensure existing users can login
 * after implementing email verification feature
 *
 * Usage: node scripts/auto-verify-existing-users.js
 */

const autoVerifyExistingUsers = async () => {
  try {
    console.log("🔍 Checking for users that need verification...");

    // Count users that are not verified
    const unverifiedCount = await prisma.employee.count({
      where: { emailVerified: false },
    });

    if (unverifiedCount === 0) {
      console.log("✅ All users are already verified. Nothing to do!");
      return;
    }

    console.log(
      `📝 Found ${unverifiedCount} unverified users. Auto-verifying them now...`
    );

    // Update all unverified users to verified
    const result = await prisma.employee.updateMany({
      where: { emailVerified: false },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    console.log(`✅ Successfully verified ${result.count} existing users!`);
    console.log(
      "🎉 All existing users can now login without email verification."
    );
  } catch (error) {
    console.error("❌ Error auto-verifying users:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

// Run the script
autoVerifyExistingUsers().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
