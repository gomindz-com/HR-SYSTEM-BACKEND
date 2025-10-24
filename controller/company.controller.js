import prisma from "../config/prisma.config.js";
import { generateToken } from "../emails/utils.js";
import bcrypt from "bcryptjs";
import moment from "moment-timezone";
import crypto from "crypto";
import { sendVerificationEmail } from "../emails/verificationEmail.js";

export const signUpCompany = async (req, res) => {
  const { companyName, HRName, HREmail, HRPassword, confirmHRPassword } =
    req.body;

  try {
    // Check if HR email already exists
    const existingHR = await prisma.employee.findUnique({
      where: {
        email: HREmail,
      },
    });

    if (existingHR) {
      return res.status(400).json({ message: "HR email already exists" });
    }

    if (HRPassword !== confirmHRPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const company = await prisma.company.create({
      data: {
        companyName,
        // Optional fields can be added later through settings
        timezone: "UTC", // Default timezone
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
        // Optional fields can be added later through profile settings
        role: "ADMIN",
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

    // Create a default company location (will use fixed 40m radius)
    await prisma.companyLocation.create({
      data: {
        companyId: company.id,
        name: "Main Office",
        latitude: 0,
        longitude: 0,
        isActive: true,
      },
    });

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.employee.update({
      where: { id: newHR.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expiresAt,
      },
    });

    // Send verification email
    await sendVerificationEmail(HREmail, verificationToken, HRName);

    res.status(201).json({
      success: true,
      message:
        "Signup successful! Please check your email to verify your account.",
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

export const createCompanyLocation = async (req, res) => {
  const { id } = req.user;
  const { companyId } = req.user;
  const { name, latitude, longitude } = req.body;

  if (!id || !companyId) {
    return res.status(401).json({
      message: "Your session has expired. Please logout and login again.",
    });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(401).json({
      message: "You are not authorized to add a company location",
    });
  }

  if (!name || !latitude || !longitude) {
    return res.status(400).json({
      message: "All fields are required",
    });
  }

  try {
    const newLocation = await prisma.companyLocation.create({
      data: {
        name,
        latitude,
        longitude,
        companyId,
      },
    });

    res.status(201).json({
      success: true,
      message: "Company location added successfully",
      data: newLocation,
    });
  } catch (error) {
    console.error("Error in createCompanyLocation controller:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getCompanyLocations = async (req, res) => {
  const { id } = req.user;
  const { companyId } = req.user;

  if (!id || !companyId) {
    return res.status(401).json({
      message: "Your session has expired. Please logout and login again.",
    });
  }

  try {
    const locations = await prisma.companyLocation.findMany({
      where: { companyId },
    });

    res.status(200).json({
      success: true,
      message: "Company locations retrieved successfully",
      data: { locations },
    });
  } catch (error) {
    console.error("Error in getCompanyLocations controller:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCompanyLocation = async (req, res) => {
  const { id } = req.user;
  const { companyId } = req.user;
  const { id: locationId } = req.params;

  if (!id || !companyId) {
    return res.status(401).json({
      message: "Your session has expired. Please logout and login again.",
    });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(401).json({
      message: "You are not authorized to update a company location",
    });
  }

  try {
    const allowedUpdates = ["name", "latitude", "longitude"];

    const updateData = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field]) {
        updateData[field] = req.body[field];
      }
    });

    // Convert locationId to number for Prisma
    const numericLocationId = parseInt(locationId, 10);

    if (isNaN(numericLocationId)) {
      return res.status(400).json({
        message: "Invalid location ID format",
      });
    }

    const updatedLocation = await prisma.companyLocation.update({
      where: { id: numericLocationId },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      message: "Company location updated successfully",
      data: updatedLocation,
    });
  } catch (error) {
    console.error("Error in updateCompanyLocation controller:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCompanyLocation = async (req, res) => {
  const { id: locationId } = req.params;

  if (!req.user.id || !req.user.companyId) {
    return res.status(401).json({
      message: "Your session has expired. Please logout and login again.",
    });
  }

  if (!locationId) {
    return res.status(400).json({
      message: "Location ID is required",
    });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(401).json({
      message: "You are not authorized to delete a company location",
    });
  }

  try {
    // Convert locationId to number for Prisma
    const numericLocationId = parseInt(locationId, 10);

    if (isNaN(numericLocationId)) {
      return res.status(400).json({
        message: "Invalid location ID format",
      });
    }

    const deletedLocation = await prisma.companyLocation.delete({
      where: { id: numericLocationId },
    });

    res.status(200).json({
      success: true,
      message: "Location deleted successfully",
      data: deletedLocation,
    });
  } catch (error) {
    console.error("Error in deleteCompanyLocation controller:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getWorkdayConfig = async (req, res) => {
  const { companyId } = req.user;

  try {
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: "unauthorized, make sure you are logged in",
      });
    }

    let workdays = await prisma.workdayDaysConfig.findFirst({
      where: { companyId },
    });

    // If no config exists, use schema defaults
    if (!workdays) {
      workdays = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      };
    }

    return res.status(200).json({
      success: true,
      message: "workday config retrieved successfully",
      data: workdays,
    });
  } catch (error) {
    console.error("Error in getWorkdayConfig controller: ", error);
    return res
      .status(500)
      .json({ success: false, message: `${error.message}` });
  }
};

export const updateWorkdayConfiguration = async (req, res) => {
  const companyId = req.user.companyId;
  const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } =
    req.body;

  try {
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: "unauthorized, make sure you are logged in",
      });
    }

    // Validate that at least one day is selected
    const workdays = [
      monday,
      tuesday,
      wednesday,
      thursday,
      friday,
      saturday,
      sunday,
    ];
    const hasWorkday = workdays.some((day) => day === true);

    if (!hasWorkday) {
      return res.status(400).json({
        success: false,
        message: "At least one workday must be selected",
      });
    }

    // Find existing workday configuration
    let existingConfig = await prisma.workdayDaysConfig.findFirst({
      where: { companyId },
    });

    let workdayConfig;

    // If no config exists, create one with the provided values
    if (!existingConfig) {
      workdayConfig = await prisma.workdayDaysConfig.create({
        data: {
          companyId,
          monday,
          tuesday,
          wednesday,
          thursday,
          friday,
          saturday,
          sunday,
        },
      });
    } else {
      // Update existing configuration
      workdayConfig = await prisma.workdayDaysConfig.update({
        where: { id: existingConfig.id },
        data: {
          monday,
          tuesday,
          wednesday,
          thursday,
          friday,
          saturday,
          sunday,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Workday configuration updated successfully",
      data: workdayConfig,
    });
  } catch (error) {
    console.error("Error updating workday configuration:", error);
    return res.status(500).json({
      success: false,
      message: `${error.message}`,
    });
  }
};
