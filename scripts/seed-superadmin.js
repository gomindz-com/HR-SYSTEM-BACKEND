import prisma from "../config/prisma.config.js";
import bcrypt from "bcryptjs";

/**
 * Seed super admin user to the database
 * Super admin does not belong to any company
 * Multiple super admins are allowed (each with unique email)
 *
 * Usage:
 *   node scripts/seed-superadmin.js
 *   node scripts/seed-superadmin.js email@example.com password123 "Super Admin Name"
 *
 * Environment variables (optional):
 *   SUPER_ADMIN_EMAIL - Email for super admin (default: "superadmin@example.com")
 *   SUPER_ADMIN_PASSWORD - Password for super admin (default: "admin123")
 *   SUPER_ADMIN_NAME - Name for super admin (default: "Super Admin")
 */

const seedSuperAdmin = async () => {
  try {
    // Get values from command line args or environment variables or use defaults
    const email =
      process.argv[2] ||
      process.env.SUPER_ADMIN_EMAIL ||
      "superadmin@example.com";
    const password =
      process.argv[3] || process.env.SUPER_ADMIN_PASSWORD || "admin123";
    const name =
      process.argv[4] || process.env.SUPER_ADMIN_NAME || "Super Admin";

    console.log("🌱 Starting to seed super admin...");

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists (multiple super admins allowed, but emails must be unique)
    const existing = await prisma.employee.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existing) {
      console.log("⚠️  User with this email already exists!");
      console.log(`   Email: ${existing.email}`);
      console.log(`   Name: ${existing.name}`);
      console.log(`   Role: ${existing.role}`);
      console.log(`   ID: ${existing.id}`);
      console.log(
        "\n💡 Tip: Use a different email to create another super admin."
      );
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create super admin
    const superAdmin = await prisma.employee.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: "SUPER_ADMIN",
        companyId: null, // Super admin does not belong to any company
        departmentId: null, // Super admin has no department
        emailVerified: true, // Auto-verify so they can login immediately
        status: "ACTIVE",
      },
    });

    console.log("✅ Super admin created successfully!");
    console.log(`   ID: ${superAdmin.id}`);
    console.log(`   Name: ${superAdmin.name}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Role: ${superAdmin.role}`);
    console.log(`   Company: None (Super Admin)`);
    console.log("\n🎉 Super admin seeding completed!");
  } catch (error) {
    console.error("❌ Error seeding super admin:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

// Run the seeding function
seedSuperAdmin().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
