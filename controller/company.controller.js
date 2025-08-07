import prisma from "../config/prisma.config.js";
import { generateToken } from "../emails/utils.js";
import bcrypt from "bcryptjs";
import moment from "moment-timezone";

export const signUpCompany = async (req, res) => {
  const {
    companyName,
    companyEmail,
    companyTin,
    companyAddress,
    companyDescription,
    timezone,
    HRName,
    HRPhone,
    HRAddress,
    HREmail,
    HRPassword,
    confirmHRPassword,
  } = req.body;

  try {
    const existingCompany = await prisma.company.findUnique({
      where: {
        companyEmail,
      },
    });

    const existingHR = await prisma.employee.findUnique({
      where: {
        email: HREmail,
      },
    });

    if (existingHR) {
      return res.status(400).json({ message: "HR already exists" });
    }

    if (HRPassword !== confirmHRPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (existingCompany) {
      return res.status(400).json({ message: "Company already exists" });
    }

    const existingCompanyWithTin = await prisma.company.findUnique({
      where: {
        companyTin,
      },
    });

    if (existingCompanyWithTin) {
      return res.status(400).json({ message: "Company with this TIN already exists" });
    }

    const company = await prisma.company.create({
      data: {
        companyName,
        companyEmail,
        companyTin,
        companyAddress,
        companyDescription,
        timezone: timezone || "UTC", // Default to UTC if not provided
      },
    });

    const hrDepartment = await prisma.department.create({
      data: {
        name: "HR Department",
        companyId: company.id,
      },
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(HRPassword, salt);
    const idx = Math.floor(Math.random() * 100) + 1;
    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

    const newHR = await prisma.employee.create({
      data: {
        name: HRName,
        email: HREmail,
        password: hashedPassword,
        phone: HRPhone,
        address: HRAddress,
        role: "HR",
        position: "HR Manager",
        companyId: company.id,
        profilePic: randomAvatar,
        departmentId: hrDepartment.id,
      },
    });

    await prisma.company.update({
      where: { id: company.id },
      data: { hrId: newHR.id },
    });

    await prisma.department.update({
      where: { id: hrDepartment.id },
      data: { managerId: newHR.id },
    });

    generateToken(newHR.id, res);
    res.status(201).json({
      success: true,
      message: "Company created and HR registered successfully",
      data: { newHR },
    });
  } catch (error) {
    console.log("Error in signUpCompany", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update company attendance settings
 */
export const updateAttendanceSettings = async (req, res) => {
  const { companyId } = req.user;
  const {
    timezone,
    workStartTime,
    workEndTime,
    lateThreshold,
    checkInDeadline,
  } = req.body;

  try {
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (workStartTime && !timeRegex.test(workStartTime)) {
      return res.status(400).json({
        message:
          "Invalid work start time format. Use HH:MM format (e.g., 09:00)",
      });
    }
    if (workEndTime && !timeRegex.test(workEndTime)) {
      return res.status(400).json({
        message: "Invalid work end time format. Use HH:MM format (e.g., 17:00)",
      });
    }

    // Validate numeric fields
    if (lateThreshold && (lateThreshold < 0 || lateThreshold > 120)) {
      return res.status(400).json({
        message: "Late threshold must be between 0 and 120 minutes",
      });
    }
    if (checkInDeadline && (checkInDeadline < 0 || checkInDeadline > 120)) {
      return res.status(400).json({
        message: "Check-in deadline must be between 0 and 120 minutes",
      });
    }

    // Update company settings
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        timezone: timezone || undefined,
        workStartTime: workStartTime || undefined,
        workEndTime: workEndTime || undefined,
        lateThreshold: lateThreshold || undefined,
        checkInDeadline: checkInDeadline || undefined,
      },
      select: {
        id: true,
        companyName: true,
        timezone: true,
        workStartTime: true,
        workEndTime: true,
        lateThreshold: true,
        checkInDeadline: true,
      },
    });

    // Get timezone info for response
    return res.status(200).json({
      message: "Attendance settings updated successfully",
      data: updatedCompany,
    });
  } catch (error) {
    console.error("Error updating attendance settings:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get company attendance settings
 */
export const getAttendanceSettings = async (req, res) => {
  const { companyId } = req.user;

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyName: true,
        timezone: true,
        workStartTime: true,
        workEndTime: true,
        lateThreshold: true,
        checkInDeadline: true,
      },
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Get timezone info for response
    return res.status(200).json({
      message: "Attendance settings retrieved successfully",
      data: company,
    });
  } catch (error) {
    console.error("Error getting attendance settings:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get available timezones
 */
export const getAvailableTimezones = async (req, res) => {
  try {
    // Get all timezone names
    const timezoneNames = moment.tz.names();

    // Create a list of timezones with their current offsets
    const timezones = timezoneNames.map((name) => {
      const offset = moment.tz(name).format("Z"); // e.g., "+01:00", "-05:00"
      const currentTime = moment.tz(name).format("HH:mm"); // Current time in that timezone
      const displayName = `${name} (UTC${offset}) - ${currentTime}`;

      return {
        value: name,
        label: displayName,
        offset: offset,
        currentTime: currentTime,
      };
    });

    // Sort by offset (UTC first, then by offset)
    timezones.sort((a, b) => {
      if (a.value === "UTC") return -1;
      if (b.value === "UTC") return 1;
      return a.offset.localeCompare(b.offset);
    });

    // Group by region for better organization
    const groupedTimezones = {
      Popular: [
        {
          value: "UTC",
          label: "UTC (UTC+00:00) - Universal Time",
          offset: "+00:00",
          currentTime: moment.utc().format("HH:mm"),
        },
        {
          value: "America/New_York",
          label: "America/New_York (UTC-05:00) - Eastern Time",
          offset: "-05:00",
          currentTime: moment.tz("America/New_York").format("HH:mm"),
        },
        {
          value: "America/Los_Angeles",
          label: "America/Los_Angeles (UTC-08:00) - Pacific Time",
          offset: "-08:00",
          currentTime: moment.tz("America/Los_Angeles").format("HH:mm"),
        },
        {
          value: "Europe/London",
          label: "Europe/London (UTC+00:00) - British Time",
          offset: "+00:00",
          currentTime: moment.tz("Europe/London").format("HH:mm"),
        },
        {
          value: "Europe/Paris",
          label: "Europe/Paris (UTC+01:00) - Central European Time",
          offset: "+01:00",
          currentTime: moment.tz("Europe/Paris").format("HH:mm"),
        },
        {
          value: "Asia/Tokyo",
          label: "Asia/Tokyo (UTC+09:00) - Japan Time",
          offset: "+09:00",
          currentTime: moment.tz("Asia/Tokyo").format("HH:mm"),
        },
        {
          value: "Asia/Singapore",
          label: "Asia/Singapore (UTC+08:00) - Singapore Time",
          offset: "+08:00",
          currentTime: moment.tz("Asia/Singapore").format("HH:mm"),
        },
        {
          value: "Asia/Kolkata",
          label: "Asia/Kolkata (UTC+05:30) - India Time",
          offset: "+05:30",
          currentTime: moment.tz("Asia/Kolkata").format("HH:mm"),
        },
      ],
      Africa: timezones.filter((tz) => tz.value.startsWith("Africa/")),
      America: timezones.filter((tz) => tz.value.startsWith("America/")),
      Asia: timezones.filter((tz) => tz.value.startsWith("Asia/")),
      Europe: timezones.filter((tz) => tz.value.startsWith("Europe/")),
      Pacific: timezones.filter((tz) => tz.value.startsWith("Pacific/")),
      Australia: timezones.filter((tz) => tz.value.startsWith("Australia/")),
      Other: timezones.filter(
        (tz) =>
          !tz.value.startsWith("Africa/") &&
          !tz.value.startsWith("America/") &&
          !tz.value.startsWith("Asia/") &&
          !tz.value.startsWith("Europe/") &&
          !tz.value.startsWith("Pacific/") &&
          !tz.value.startsWith("Australia/") &&
          tz.value !== "UTC"
      ),
    };

    return res.status(200).json({
      message: "Available timezones retrieved successfully",
      data: groupedTimezones,
    });
  } catch (error) {
    console.error("Error getting timezones:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get company basic information
 */
export const getCompanyInfo = async (req, res) => {
  const { companyId } = req.user;

  if (!companyId) {
    return res.status(401).json({
      message: "Your session has expired. Please logout and login again.",
    });
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyName: true,
        companyEmail: true,
        companyTin: true,
        companyAddress: true,
        companyDescription: true,
        timezone: true,
      },
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.status(200).json({
      success: true,
      message: "Company information retrieved successfully",
      data: company,
    });
  } catch (error) {
    console.error("Error getting company info:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update company basic information
 */
export const updateCompanyInfo = async (req, res) => {
  const { companyId } = req.user;

  if (!companyId) {
    return res.status(401).json({
      message: "Your session has expired. Please logout and login again.",
    });
  }

  try {
    const allowedUpdates = [
      "companyName",
      "companyEmail",
      "companyTin",
      "companyAddress",
      "companyDescription",
      "timezone",
    ];
    const updateData = {};

    // Handle form data fields
    allowedUpdates.forEach((field) => {
      if (req.body[field]) {
        updateData[field] = req.body[field];
      }
    });

    // Check if email or TIN already exists (if being updated)
    if (updateData.companyEmail) {
      const existingCompanyWithEmail = await prisma.company.findFirst({
        where: {
          companyEmail: updateData.companyEmail,
          id: { not: companyId },
        },
      });
      if (existingCompanyWithEmail) {
        return res.status(400).json({
          message: "A company with this email already exists",
        });
      }
    }

    if (updateData.companyTin) {
      const existingCompanyWithTin = await prisma.company.findFirst({
        where: {
          companyTin: updateData.companyTin,
          id: { not: companyId },
        },
      });
      if (existingCompanyWithTin) {
        return res.status(400).json({
          message: "A company with this TIN already exists",
        });
      }
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: updateData,
      select: {
        id: true,
        companyName: true,
        companyEmail: true,
        companyTin: true,
        companyAddress: true,
        companyDescription: true,
      },
    });

    if (!updatedCompany) {
      return res
        .status(404)
        .json({ message: "Company not found or unauthorized" });
    }

    res.status(200).json({
      success: true,
      message: "Company information updated successfully",
      data: updatedCompany,
    });
  } catch (error) {
    console.error("Error updating company info:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
