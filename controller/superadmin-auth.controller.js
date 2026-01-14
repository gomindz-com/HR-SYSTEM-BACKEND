import prisma from "../config/prisma.config.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../emails/utils.js";

/**
 * Superadmin Login Controller
 * Separate from regular auth to ensure SUPER_ADMIN role validation
 * and skip email verification requirement
 */
export const superadminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Normalize email to handle case sensitivity and whitespace
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.employee.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        position: true,
        profilePic: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        dateOfBirth: true,
        emergencyContact: true,
        status: true,
        role: true,
        departmentId: true,
        companyId: true,
        password: true, // We need this for password comparison
        emailVerified: true,
        createdAt: true,
        deleted: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Validate that user is SUPER_ADMIN
    if (user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Access denied. Super admin credentials required.",
      });
    }

    if (user.deleted) {
      return res.status(401).json({ message: "Your account has been deleted" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // SUPER_ADMIN doesn't need email verification, but we check status
    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Your account is not active. Please contact support.",
      });
    }

    // Generate token and return it in response body
    const token = generateToken(user.id, res);

    // Exclude sensitive fields like password
    const { password: _password, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: userWithoutPassword,
        token: token, // Return token in response
      },
    });
  } catch (error) {
    console.log("Error in superadminLogin", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Superadmin Check Auth Controller
 * Validates that the authenticated user is a SUPER_ADMIN
 */
export const superadminCheckAuth = async (req, res) => {
  const { id } = req.user;

  try {
    const user = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        position: true,
        profilePic: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        dateOfBirth: true,
        emergencyContact: true,
        status: true,
        role: true,
        departmentId: true,
        companyId: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate that user is SUPER_ADMIN
    if (user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin access required.",
      });
    }

    res.status(200).json({
      success: true,
      message: "User is authenticated",
      data: {
        user,
      },
    });
  } catch (error) {
    console.log("Error in superadminCheckAuth", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Superadmin Logout Controller
 */
export const superadminLogout = async (req, res) => {
  try {
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in superadminLogout", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
