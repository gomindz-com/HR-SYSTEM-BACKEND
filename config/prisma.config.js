import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import pg from "pg";

let connectionString =
  process.env.HR_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL or HR_DATABASE_URL environment variable is not set"
  );
}

// Remove all query parameters from the connection string
// We handle SSL via pool config, so query params like sslmode and channel_binding are not needed
// Split on '?' to separate the base URL from query parameters
const baseUrl = connectionString.split('?')[0];
connectionString = baseUrl;

// Create a singleton instance for better connection management
let prisma = null;

if (process.env.NODE_ENV === "production") {
  // In production, use connection pooling with adapter
  // Note: SSL config must match connection string sslmode
  const pool = new pg.Pool({
    connectionString,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    // SSL configuration for self-signed certificates - must be set as object
    ssl: {
      rejectUnauthorized: false, // Accept self-signed certificates
    },
  });

  const adapter = new PrismaPg(pool);

  prisma = new PrismaClient({
    adapter,
    log: ["error"], // Only log errors in production
  });
} else {
  // In development, use global instance to prevent multiple connections
  if (!global.prisma) {
    const pool = new pg.Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      // SSL configuration for self-signed certificates - must be set as object
      ssl: {
        rejectUnauthorized: false, // Accept self-signed certificates
      },
    });

    const adapter = new PrismaPg(pool);

    global.prisma = new PrismaClient({
      adapter,
      log: ["error"],
    });
  }
  prisma = global.prisma;
}

// Add error handling
prisma.$on("error", (e) => {
  if (e.code === "P1001" || e.code === "P1002") {
    console.log(
      "Database connection issue detected - will retry automatically"
    );
  } else {
    console.error("Prisma error:", e.message);
  }
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
    console.log(" Using database: PostgreSQL with Prisma 7 adapter");
  })
  .catch((error) => {
    console.error("❌ Failed to connect to database:", error.message);
    process.exit(1);
  });

export default prisma;
