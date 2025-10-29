import prisma from "../config/prisma.config.js";

/**
 * Create 14-day Enterprise trial subscriptions for existing companies
 * This is a one-time migration script to set up trials for production companies
 *
 * Only creates trials for companies that:
 * - Don't have lifetime access (hasLifetimeAccess = false)
 * - Don't already have a subscription
 *
 * Usage:
 *   node scripts/create-trial-subscriptions.js           # Creates trials for all eligible companies
 *   node scripts/create-trial-subscriptions.js 2         # Creates trial for company ID 2
 */

const createTrialSubscriptions = async (companyId = null) => {
  try {
    if (companyId) {
      console.log(`🔍 Creating trial for company ID ${companyId}...`);
    } else {
      console.log("🔍 Finding companies that need trial subscriptions...");
    }

    // Get Enterprise plan (everyone gets full access during trial)
    const enterprisePlan = await prisma.subscriptionPlan.findFirst({
      where: { name: "Enterprise" },
    });

    if (!enterprisePlan) {
      throw new Error(
        "Enterprise plan not found! Please run 'node scripts/seed-plans.js' first."
      );
    }

    // Build where clause - filter by companyId if provided
    const whereClause = {
      hasLifetimeAccess: false,
      subscription: null,
    };

    if (companyId) {
      whereClause.id = parseInt(companyId);
    }

    const companies = await prisma.company.findMany({
      where: whereClause,
      select: {
        id: true,
        companyName: true,
        hasLifetimeAccess: true,
      },
    });

    if (companies.length === 0) {
      if (companyId) {
        // If a specific company ID was requested, check why it wasn't found
        const company = await prisma.company.findUnique({
          where: { id: parseInt(companyId) },
          select: {
            id: true,
            companyName: true,
            hasLifetimeAccess: true,
            subscription: { select: { id: true, status: true } },
          },
        });

        if (!company) {
          throw new Error(`Company with ID ${companyId} not found`);
        }

        if (company.hasLifetimeAccess) {
          throw new Error(
            `Company ${company.companyName} (ID: ${companyId}) has lifetime access. No subscription needed.`
          );
        }

        if (company.subscription) {
          throw new Error(
            `Company ${company.companyName} (ID: ${companyId}) already has a subscription with status: ${company.subscription.status}`
          );
        }
      } else {
        console.log(
          "✅ No companies need trial subscriptions. All companies either have lifetime access or existing subscriptions."
        );
      }
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
const args = process.argv.slice(2);
const companyId = args[0] || null;

createTrialSubscriptions(companyId).catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
