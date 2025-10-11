import prisma from "../config/prisma.config.js";

/**
 * Test migration readiness - checks if database is ready for production deployment
 * This script verifies:
 * 1. Subscription plans exist
 * 2. Companies are properly configured
 * 3. Email verification fields exist
 *
 * Usage: node scripts/test-migration.js
 */

const testMigration = async () => {
  try {
    console.log("🧪 Testing migration readiness...\n");

    // Test 1: Check subscription plans
    console.log("1️⃣  Checking subscription plans...");
    const plans = await prisma.subscriptionPlan.findMany();

    if (plans.length === 0) {
      console.log("❌ No subscription plans found!");
      console.log("   Run: node scripts/seed-plans.js");
    } else {
      console.log(`✅ Found ${plans.length} subscription plans:`);
      plans.forEach((plan) => {
        console.log(
          `   - ${plan.name}: $${plan.price}/month (Max employees: ${plan.maxEmployees || "Unlimited"})`
        );
      });
    }

    // Test 2: Check companies
    console.log("\n2️⃣  Checking companies...");
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        companyName: true,
        hasLifetimeAccess: true,
        subscription: {
          select: {
            status: true,
            trialEndDate: true,
            plan: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (companies.length === 0) {
      console.log("❌ No companies found!");
    } else {
      console.log(`✅ Found ${companies.length} companies:\n`);

      const lifetimeCompanies = companies.filter((c) => c.hasLifetimeAccess);
      const trialCompanies = companies.filter(
        (c) => c.subscription?.status === "TRIAL"
      );
      const activeCompanies = companies.filter(
        (c) => c.subscription?.status === "ACTIVE"
      );
      const noSubscription = companies.filter(
        (c) => !c.hasLifetimeAccess && !c.subscription
      );

      console.log(`   📊 Company Status Summary:`);
      console.log(`   - Lifetime Access: ${lifetimeCompanies.length}`);
      console.log(`   - Active Trial: ${trialCompanies.length}`);
      console.log(`   - Active Subscription: ${activeCompanies.length}`);
      console.log(`   - No Subscription: ${noSubscription.length}\n`);

      companies.forEach((company) => {
        let status = "";
        if (company.hasLifetimeAccess) {
          status = "🌟 Lifetime Access";
        } else if (company.subscription) {
          const daysLeft = company.subscription.trialEndDate
            ? Math.ceil(
                (new Date(company.subscription.trialEndDate) - new Date()) /
                  (1000 * 60 * 60 * 24)
              )
            : 0;
          status = `${company.subscription.status} - ${company.subscription.plan.name}`;
          if (company.subscription.status === "TRIAL") {
            status += ` (${daysLeft} days left)`;
          }
        } else {
          status = "⚠️  No Subscription";
        }

        console.log(`   ${company.id}. ${company.companyName} - ${status}`);
      });
    }

    // Test 3: Check employee email verification
    console.log("\n3️⃣  Checking employee email verification...");
    const totalEmployees = await prisma.employee.count();
    const verifiedEmployees = await prisma.employee.count({
      where: { emailVerified: true },
    });
    const unverifiedEmployees = totalEmployees - verifiedEmployees;

    console.log(`✅ Total employees: ${totalEmployees}`);
    console.log(`   - Verified: ${verifiedEmployees}`);
    console.log(`   - Unverified: ${unverifiedEmployees}`);

    if (unverifiedEmployees > 0) {
      console.log(`   ⚠️  ${unverifiedEmployees} users need verification!`);
      console.log(`   Run: node scripts/auto-verify-existing-users.js`);
    }

    // Test 4: Check for companies needing trials
    console.log("\n4️⃣  Checking for companies needing trial subscriptions...");
    const companiesNeedingTrials = await prisma.company.count({
      where: {
        hasLifetimeAccess: false,
        subscription: null,
      },
    });

    if (companiesNeedingTrials > 0) {
      console.log(
        `⚠️  ${companiesNeedingTrials} companies need trial subscriptions!`
      );
      console.log(`   Run: node scripts/create-trial-subscriptions.js`);
    } else {
      console.log(
        "✅ All companies have either lifetime access or subscriptions"
      );
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 MIGRATION READINESS SUMMARY");
    console.log("=".repeat(60));

    const issues = [];

    if (plans.length === 0) issues.push("No subscription plans found");
    if (unverifiedEmployees > 0)
      issues.push(`${unverifiedEmployees} unverified employees`);
    if (companiesNeedingTrials > 0)
      issues.push(`${companiesNeedingTrials} companies need trials`);

    if (issues.length === 0) {
      console.log("✅ All checks passed! Ready for production deployment.");
    } else {
      console.log("⚠️  Issues found:");
      issues.forEach((issue) => console.log(`   - ${issue}`));
      console.log(
        "\nℹ️  Run the suggested commands above to fix these issues."
      );
    }

    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("❌ Error testing migration:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

// Run the test
testMigration().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
