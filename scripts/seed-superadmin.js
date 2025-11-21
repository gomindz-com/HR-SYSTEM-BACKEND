import prisma from "../config/prisma.config.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const seedSuperAdmin = async () => {
  try {
    console.log("🌱 Starting to seed super admin...");

    // Get email and password from environment variables or use defaults
    const email = process.env.SUPER_ADMIN_EMAIL || "superadmin@hrsystem.com";
    const password = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin123!";
    const name = process.env.SUPER_ADMIN_NAME || "Super Admin";

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if super admin already exists
    const existingSuperAdmin = await prisma.employee.findFirst({
      where: {
        email: normalizedEmail,
        role: "SUPER_ADMIN",
      },
    });

    if (existingSuperAdmin) {
      console.log(
        `⚠️  Super admin with email ${normalizedEmail} already exists. Skipping...`
      );
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate random avatar
    const idx = Math.floor(Math.random() * 100) + 1;
    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

    // Create super admin employee
    const superAdmin = await prisma.employee.create({
      data: {
        name: name,
        email: normalizedEmail,
        password: hashedPassword,
        role: "SUPER_ADMIN",
        position: "Super Administrator",
        companyId: null, // No company association
        departmentId: null, // No department association
        emailVerified: true, // Auto-verified for super admin
        status: "ACTIVE",
        profilePic: randomAvatar,
      },
    });

    console.log(`✅ Super admin created successfully!`);
    console.log(`   Email: ${normalizedEmail}`);
    console.log(`   Name: ${name}`);
    console.log(`   Role: SUPER_ADMIN`);
    console.log(`   ID: ${superAdmin.id}`);
    console.log(`\n⚠️  Please change the default password after first login!`);
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
