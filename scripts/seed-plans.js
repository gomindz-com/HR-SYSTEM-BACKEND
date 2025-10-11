import { PrismaClient } from "@prisma/client";
import { SUBSCRIPTION_PLANS } from "../config/plans.config.js";

const prisma = new PrismaClient();

const seedPlans = async () => {
  try {
    console.log("🌱 Starting to seed subscription plans...");

    for (const [key, planData] of Object.entries(SUBSCRIPTION_PLANS)) {
      const plan = await prisma.subscriptionPlan.upsert({
        where: { id: planData.id },
        update: {
          name: planData.name,
          price: planData.price,
          maxEmployees: planData.maxEmployees,
          features: planData.features,
        },
        create: {
          id: planData.id,
          name: planData.name,
          price: planData.price,
          maxEmployees: planData.maxEmployees,
          features: planData.features,
        },
      });

      console.log(`✅ ${plan.name} plan seeded successfully`);
    }

    console.log("🎉 All plans seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding plans:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

// Run the seeding function
seedPlans().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
