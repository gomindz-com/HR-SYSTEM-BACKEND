import prisma from "../config/prisma.config.js";

/**
 * Create a pending subscription for a specific company
 * Usage: node scripts/create-pending-sub.js companyId [planName]
 * 
 * Examples:
 *   node scripts/create-pending-sub.js 1
 *   node scripts/create-pending-sub.js 1 Basic
 *   node scripts/create-pending-sub.js 1 Professional
 *   node scripts/create-pending-sub.js 1 Enterprise
 */

const createPendingSubscription = async (companyId, planName = "Enterprise") => {
  try {
    console.log(`🔍 Creating pending subscription for company ${companyId}...`);

    // Validate company exists
    const company = await prisma.company.findUnique({
      where: { id: parseInt(companyId) },
      select: {
        id: true,
        companyName: true,
        hasLifetimeAccess: true,
        subscription: {
          select: {
            id: true,
            status: true,
            plan: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!company) {
      throw new Error(`Company with ID ${companyId} not found`);
    }

    console.log(`📋 Company: ${company.companyName} (ID: ${company.id})`);

    // Check if company has lifetime access
    if (company.hasLifetimeAccess) {
      console.log("⚠️  Company has lifetime access. No subscription needed.");
      return;
    }

    // Check if company already has a subscription
    if (company.subscription) {
      console.log(`⚠️  Company already has a subscription (${company.subscription.status}) with plan: ${company.subscription.plan.name}`);
      console.log("   To create a new subscription, first cancel the existing one.");
      return;
    }

    // Get the requested plan
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { 
        name: planName,
        isActive: true 
      },
    });

    if (!plan) {
      throw new Error(`Plan '${planName}' not found. Available plans: Basic, Professional, Enterprise`);
    }

    console.log(`📦 Selected plan: ${plan.name} (${plan.price} GMD per user/month)`);

    // Get active employee count for pricing calculation
    const employeeCount = await prisma.employee.count({
      where: { 
        companyId: parseInt(companyId), 
        deleted: false 
      },
    });

    console.log(`👥 Active employees: ${employeeCount}`);

    // Calculate total amount (price per user × number of users)
    const totalAmount = plan.price * employeeCount;
    console.log(`💰 Total amount: ${totalAmount} GMD (${plan.price} × ${employeeCount} users)`);

    // Create pending subscription
    const subscription = await prisma.subscription.create({
      data: {
        companyId: parseInt(companyId),
        planId: plan.id,
        status: "PENDING",
        startDate: new Date(),
        // No endDate set for pending subscriptions - will be set after payment
      },
      include: {
        plan: true,
        company: {
          select: {
            companyName: true,
          },
        },
      },
    });

    console.log("\n✅ Pending subscription created successfully!");
    console.log(`   Subscription ID: ${subscription.id}`);
    console.log(`   Company: ${subscription.company.companyName}`);
    console.log(`   Plan: ${subscription.plan.name}`);
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Amount: ${totalAmount} GMD`);
    console.log(`   Employee count: ${employeeCount}`);
    console.log("\n💡 Next steps:");
    console.log("   1. Company needs to complete payment to activate subscription");
    console.log("   2. Use the subscription controller to generate payment links");
    console.log("   3. Payment completion will automatically activate the subscription");

  } catch (error) {
    console.error("❌ Error creating pending subscription:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

// Run from command line
const args = process.argv.slice(2);
const companyId = args[0];
const planName = args[1] || "Enterprise";

if (!companyId) {
  console.log(`
Usage: node scripts/create-pending-sub.js companyId [planName]

Arguments:
  companyId  - The ID of the company to create subscription for
  planName   - Optional plan name (default: "Enterprise")

Available plans:
  - Basic
  - Professional  
  - Enterprise

Examples:
  node scripts/create-pending-sub.js 1
  node scripts/create-pending-sub.js 1 Basic
  node scripts/create-pending-sub.js 1 Professional
  node scripts/create-pending-sub.js 1 Enterprise
  `);
  process.exit(1);
}

createPendingSubscription(companyId, planName).catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
