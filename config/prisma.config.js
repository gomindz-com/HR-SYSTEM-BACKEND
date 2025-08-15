import { PrismaClient } from "@prisma/client";

// Create a singleton instance for better connection management
let prisma = null;

if (process.env.NODE_ENV === "production") {
  // In production, always create a new instance with optimized connection settings
  prisma = new PrismaClient({
    log: ["error"], // Only log errors in production
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Optimize connection pool for production automation workloads
    __internal: {
      engine: {
        connectTimeout: 30000, // 30 seconds
        queryTimeout: 60000, // 60 seconds
        poolTimeout: 60000, // 60 seconds
      },
    },
  });
} else {
  // In development, use global instance to prevent multiple connections
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ["error"], // Only log errors in development
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Optimize connection pool for development
      __internal: {
        engine: {
          connectTimeout: 10000, // 10 seconds
          queryTimeout: 30000, // 30 seconds
          poolTimeout: 30000, // 30 seconds
        },
      },
    });
  }
  prisma = global.prisma;
}

// Add error handling
prisma.$on("error", (e) => {
  // Only log critical errors, not connection issues
  if (e.code === "P1001" || e.code === "P1002") {
    // Connection issues - these are usually temporary
    console.log(
      "Database connection issue detected - will retry automatically"
    );
  } else {
    console.error("Prisma error:", e.message);
  }
});

// Add query logging only for development if needed
if (
  process.env.NODE_ENV === "development" &&
  process.env.LOG_QUERIES === "true"
) {
  prisma.$on("query", (e) => {
    console.log("Query:", e.query);
    console.log("Params:", e.params);
    console.log("Duration:", e.duration + "ms");
  });
}

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
    // Don't log the full database URL for security
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const urlParts = dbUrl.split("@");
      if (urlParts.length > 1) {
        console.log(` Database: ${urlParts[1]}`);
      }
    }
  })
  .catch((error) => {
    console.error("❌ Failed to connect to database:", error.message);
    process.exit(1);
  });

export default prisma;
