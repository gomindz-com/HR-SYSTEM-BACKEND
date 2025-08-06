import { PrismaClient } from "@prisma/client";

// Create a singleton instance for better connection management
let prisma = null;

if (process.env.NODE_ENV === "production") {
  // In production, always create a new instance
  prisma = new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
} else {
  // In development, use global instance to prevent multiple connections
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ["error", "warn"],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  prisma = global.prisma;
}

// Add error handling
prisma.$on("error", (e) => {
  console.error("Prisma error:", e);
});

// Graceful shutdown handling
const gracefulShutdown = async () => {
  console.log("Shutting down Prisma client...");
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// Test database connection on startup
prisma
  .$connect()
  .then(() => {
    console.log("✅ Database connection established successfully");
    console.log(" Using database: PostgreSQL");
    console.log(` Database URL: ${process.env.DATABASE_URL}`);
  })
  .catch((error) => {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1);
  });

export default prisma;
