import prisma from "../config/prisma.config.js";

/**
 * Create 14-day Enterprise trial subscriptions for existing companies
 * This is a one-time migration script to set up trials for production companies
 *
 * Only creates trials for companies that:
 * - Don't have lifetime access (hasLifetimeAccess = false)
 * - Don't already have a subscription
 *
 * Usage: node scripts/create-trial-subscriptions.js
 */

const createTrialSubscriptions = async () => {
  try {
    console.log("🔍 Finding companies that need trial subscriptions...");

    // Get Enterprise plan (everyone gets full access during trial)
    const enterprisePlan = await prisma.subscriptionPlan.findFirst({
      where: { name: "Enterprise" },
    });

    if (!enterprisePlan) {
      throw new Error(
        "Enterprise plan not found! Please run 'node scripts/seed-plans.js' first."
      );
    }

    // Find companies without lifetime access and without existing subscription
    const companies = await prisma.company.findMany({
      where: {
        hasLifetimeAccess: false,
        subscription: null,
      },
      select: {
        id: true,
        companyName: true,
        hasLifetimeAccess: true,
      },
    });

    if (companies.length === 0) {
      console.log(
        "✅ No companies need trial subscriptions. All companies either have lifetime access or existing subscriptions."
      );
      return;
    }

    console.log(
      `📝 Found ${companies.length} companies that need trial subscriptions:`
    );
    companies.forEach((company) => {
      console.log(`   - ${company.companyName} (ID: ${company.id})`);
    });

    console.log("\n🚀 Creating 14-day Enterprise trials...\n");

    // Create trial subscription for each company
    for (const company of companies) {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 days from now

      const subscription = await prisma.subscription.create({
        data: {
          companyId: company.id,
          planId: enterprisePlan.id,
          status: "TRIAL",
          startDate: new Date(),
          trialEndDate: trialEndDate,
        },
        include: {
          plan: true,
        },
      });

      console.log(
        `✅ Created trial for: ${company.companyName} (ID: ${company.id})`
      );
      console.log(`   - Trial expires: ${trialEndDate.toLocaleDateString()}`);
      console.log(`   - Plan: ${subscription.plan.name}\n`);
    }

    console.log(
      `🎉 Successfully created ${companies.length} trial subscriptions!`
    );
    console.log(
      "💡 Companies with lifetime access were automatically skipped."
    );
  } catch (error) {
    console.error("❌ Error creating trial subscriptions:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

// Run the script
createTrialSubscriptions().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
