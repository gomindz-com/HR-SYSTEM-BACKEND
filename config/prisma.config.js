import { PrismaClient } from "@prisma/client";

// Create a singleton instance for better connection management
let prisma = null;

if (process.env.NODE_ENV === "production") {
  // In production, always create a new instance
  prisma = new PrismaClient({
    log: [
      {
        emit: "stdout",
        level: "error",
      },
      {
        emit: "stdout",
        level: "warn",
      },
    ],
  });
} else {
  // In development, use global instance to prevent multiple connections
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: [
        // Only log queries if DEBUG_QUERIES is set to true
        ...(process.env.DEBUG_QUERIES === "true"
          ? [
              {
                emit: "event",
                level: "query",
              },
            ]
          : []),
        {
          emit: "stdout",
          level: "error",
        },
        {
          emit: "stdout",
          level: "info",
        },
        {
          emit: "stdout",
          level: "warn",
        },
      ],
    });
  }
  prisma = global.prisma;
}

// Add event listeners for better debugging (only if DEBUG_QUERIES is enabled)
if (process.env.DEBUG_QUERIES === "true") {
  prisma.$on("query", (e) => {
    if (process.env.NODE_ENV === "development") {
      console.log("Query: " + e.query);
      console.log("Params: " + e.params);
      console.log("Duration: " + e.duration + "ms");
    }
  });
}

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
    console.log(
      ` Using database: ${
        process.env.NODE_ENV === "production" ? "PostgreSQL" : "PostgreSQL"
      }`
    );
    console.log(` Database URL: ${process.env.DATABASE_URL}`);
    if (process.env.DEBUG_QUERIES === "true") {
      console.log(
        "🔍 Query logging enabled (set DEBUG_QUERIES=false to disable)"
      );
    }
  })
  .catch((error) => {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1);
  });

export default prisma;
