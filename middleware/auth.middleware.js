import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.config.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

export const verifyToken = async (req, res, next) => {
  // Prioritize Authorization header over cookies for better mobile compatibility
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies.jwt;

  let token = null;
  let tokenSource = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
    tokenSource = "header";
  } else if (cookieToken) {
    token = cookieToken;
    tokenSource = "cookie";
  }

  if (!token) {
    console.log("No token found in request:", {
      hasAuthHeader: !!authHeader,
      hasCookie: !!cookieToken,
      userAgent: req.headers["user-agent"],
    });
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.employee.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
      },
    });

    if (!user) {
      console.log("User not found in database:", decoded.id);
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("JWT verification error:", {
      error: error.message,
      tokenSource,
      userAgent: req.headers["user-agent"],
    });
    return res.status(403).json({ message: "Invalid/Expired token" });
  }
};
