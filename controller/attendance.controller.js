import prisma from "../config/prisma.config.js";
import { verifyQrPayload } from "../lib/utils.js";
import {
  checkCheckInWindow,
  checkCheckOutWindow,
  determineAttendanceStatus,
} from "../lib/attendance-utils.js";
import locationUtils from "../utils/location.util.js";
import {
  createActivity,
  ACTIVITY_TYPES,
  PRIORITY_LEVELS,
  ICON_TYPES,
} from "../lib/activity-utils.js";
export const checkIn = async (req, res) => {
  const { qrPayload, longitude, latitude } = req.body;
  const employeeId = req.user.id;
  const companyId = req.user.companyId;

  if (!longitude || !latitude) {
    return res
      .status(400)
      .json({ message: "location coordinates are required" });
  }

  try {
    const qrData = verifyQrPayload(qrPayload);
    if (!qrData) {
      return res.status(400).json({ message: "Invalid QR code" });
    }

    const companyLocations = await prisma.companyLocation.findMany({
      where: {
        companyId,
        isActive: true,
      },
    });

    if (companyLocations.length === 0) {
      return res
        .status(400)
        .json({ message: "No company location configured" });
    }

    const locationValidation = locationUtils.validateLocation(
      latitude,
      longitude,
      companyLocations
    );

    if (!locationValidation.valid) {
      return res.status(400).json({
        message: "You must be at the company location to clock in",
      });
    }

    // Get the validated location for storage
    const validatedLocation = locationValidation.location;

    // Get company settings for attendance rules
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        workStartTime: true,
        workEndTime: true,
        lateThreshold: true,
        checkInDeadline: true,
      },
    });

    if (!company) {
      return res.status(400).json({ message: "Company not found" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        companyId,
        employeeId,
        date: today,
      },
    });

    if (existingAttendance && existingAttendance.timeIn) {
      return res
        .status(400)
        .json({ message: "You have already checked in today" });
    }

    // Check if employee has already checked out today (prevent check-in after checkout)
    if (existingAttendance && existingAttendance.timeOut) {
      return res.status(400).json({
        message: "You have already checked out today. Cannot check in again.",
      });
    }

    // Check if check-in is allowed based on company settings
    const checkInResult = checkCheckInWindow(company);

    if (!checkInResult.isAllowed) {
      return res.status(400).json({
        message: checkInResult.reason,
        details: {
          currentTime: checkInResult.currentTime,
          workStartTime: checkInResult.workStartTime,
          workEndTime: checkInResult.workEndTime,
          deadline: checkInResult.deadline,
        },
      });
    }

    const now = new Date();
    const status = determineAttendanceStatus(now, company);

    // Use upsert to avoid unique constraint issues
    const attendance = await prisma.attendance.upsert({
      where: {
        employeeId_date: { employeeId, date: today },
      },
      update: {
        timeIn: now,
        status,
        locationId: validatedLocation.id,
      },
      create: {
        employeeId,
        companyId,
        date: today,
        timeIn: now,
        status,
        locationId: validatedLocation.id,
      },
    });

    // Create activity for successful check-in
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.ATTENDANCE,
      title: "Employee Check-in",
      description: `${req.user.name} checked in at ${now.toLocaleTimeString()}`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.ATTENDANCE,
    });

    return res
      .status(201)
      .json({ message: "Check-in successful", data: { attendance } });
  } catch (error) {
    console.error("Error in Checkin Controller", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkOut = async (req, res) => {
  const { qrPayload, longitude, latitude } = req.body;
  const employeeId = req.user.id;
  const companyId = req.user.companyId;

  if (!longitude || !latitude) {
    return res
      .status(400)
      .json({ message: "location coordinates are required" });
  }

  try {
    const qrData = verifyQrPayload(qrPayload);
    if (!qrData) {
      return res.status(400).json({ message: "Invalid QR code" });
    }

    const companyLocations = await prisma.companyLocation.findMany({
      where: { companyId, isActive: true },
    });

    if (!companyLocations || companyLocations.length === 0) {
      return res
        .status(400)
        .json({ message: "No company location configured" });
    }

    const locationValidation = locationUtils.validateLocation(
      latitude,
      longitude,
      companyLocations
    );

    if (!locationValidation.valid) {
      return res.status(400).json({
        message: "You must be at the company location to clock out",
      });
    }

    // Get the validated location for storage
    const validatedLocation = locationValidation.location;

    // Get company settings for attendance rules
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        workEndTime: true,
      },
    });

    if (!company) {
      return res.status(400).json({ message: "Company not found" });
    }

    // Check if check-out is allowed based on company settings
    const checkOutResult = checkCheckOutWindow(company);

    if (!checkOutResult.isAllowed) {
      return res.status(400).json({
        message: checkOutResult.reason,
        details: {
          currentTime: checkOutResult.currentTime,
          workEndTime: checkOutResult.workEndTime,
        },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        companyId,
        employeeId,
        date: today,
      },
    });

    if (existingAttendance && existingAttendance.timeOut) {
      return res
        .status(400)
        .json({ message: "You have already checked out today" });
    }

    if (!existingAttendance) {
      return res.status(400).json({ message: "You have not checked in today" });
    }

    const now = new Date();
    const attendance = await prisma.attendance.update({
      where: { id: existingAttendance.id },
      data: { timeOut: now },
    });

    // Create activity for successful check-out
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.ATTENDANCE,
      title: "Employee Check-out",
      description: `${req.user.name} checked out at ${now.toLocaleTimeString()}`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.ATTENDANCE,
    });

    return res
      .status(200)
      .json({ message: "Check-out successful", data: { attendance } });
  } catch (error) {
    console.log("Error in Checkout Controller", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const adminAddAttendance = async (req, res) => {
  const { employeeId } = req.params;
  const { companyId } = req.user;
  const { timeIn } = req.body;

  if (!employeeId)
    return res.status(400).json({ message: "Employee ID is required" });
  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });
  if (!timeIn) return res.status(400).json({ message: "Time In is required" });

  try {
    // Validate timeIn format
    const parsedTimeIn = new Date(timeIn);
    if (isNaN(parsedTimeIn.getTime())) {
      return res.status(400).json({
        message: "Invalid time format. Please provide a valid date/time.",
      });
    }

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: {
        id: parseInt(employeeId),
        companyId,
      },
      select: { id: true, name: true },
    });

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found or doesn't belong to this company",
      });
    }

    // Get company settings for attendance rules
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        workStartTime: true,
        workEndTime: true,
        lateThreshold: true,
        checkInDeadline: true,
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await prisma.attendance.findFirst({
      where: { employeeId: parseInt(employeeId), companyId, date: today },
    });

    if (existingAttendance && existingAttendance.timeIn) {
      return res.status(400).json({
        message: "You have already marked this employee as present today",
      });
    }

    if (existingAttendance && existingAttendance.timeOut) {
      return res.status(400).json({
        message: "You have already marked this employee as checked out today",
      });
    }

    const checkInResult = checkCheckInWindow(company);

    if (!checkInResult.isAllowed) {
      return res.status(400).json({
        message: checkInResult.reason,
        details: {
          currentTime: checkInResult.currentTime,
          workStartTime: checkInResult.workStartTime,
          workEndTime: checkInResult.workEndTime,
          deadline: checkInResult.deadline,
        },
      });
    }

    // Determine status based on the inputted check-in time, not current time
    const status = determineAttendanceStatus(parsedTimeIn, company);

    // Use upsert to avoid unique constraint issues
    const attendance = await prisma.attendance.upsert({
      where: {
        employeeId_date: { employeeId: parseInt(employeeId), date: today },
      },
      update: { timeIn, status },
      create: {
        employeeId: parseInt(employeeId),
        companyId,
        date: today,
        timeIn,
        status,
      },
    });

    return res
      .status(200)
      .json({ message: "Attendance added successfully", data: { attendance } });
  } catch (error) {
    console.log("Error in adminAddAttendance controller", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const adminClockOut = async (req, res) => {
  const { employeeId } = req.params;
  const { companyId } = req.user;
  const { timeOut } = req.body;

  if (!employeeId)
    return res.status(400).json({ message: "Employee ID is required" });
  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });
  if (!timeOut)
    return res.status(400).json({ message: "Time Out is required" });

  try {
    // Validate timeOut format
    const parsedTimeOut = new Date(timeOut);
    if (isNaN(parsedTimeOut.getTime())) {
      return res.status(400).json({
        message: "Invalid time format. Please provide a valid date/time.",
      });
    }

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: {
        id: parseInt(employeeId),
        companyId,
      },
      select: { id: true, name: true },
    });

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found or doesn't belong to this company",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find existing attendance record
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: parseInt(employeeId),
        companyId,
        date: today,
      },
    });

    if (!existingAttendance) {
      return res.status(404).json({
        message: "cannot clock out without clock in",
      });
    }

    if (existingAttendance.timeOut) {
      return res.status(400).json({
        message: "Employee has already been checked out today",
      });
    }

    // Validate that timeOut is after timeIn
    if (
      existingAttendance.timeIn &&
      parsedTimeOut <= existingAttendance.timeIn
    ) {
      return res.status(400).json({
        message: "Time out must be after time in",
      });
    }

    // Update attendance with timeOut
    const updatedAttendance = await prisma.attendance.update({
      where: { id: existingAttendance.id },
      data: { timeOut: parsedTimeOut },
    });

    return res.status(200).json({
      message: "Clock out successful",
      data: {
        attendance: updatedAttendance,
        employee: employee.name,
      },
    });
  } catch (error) {
    console.log("Error in adminClockOut controller", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const listAttendance = async (req, res) => {
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "Company ID is required" });
  }

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const skip = (page - 1) * pageSize;

  // Filters
  const { employeeId, status, date, locationId } = req.query;
  const where = { companyId };

  // Safe parse for employeeId
  const parsedEmployeeId = parseInt(employeeId);
  if (employeeId && !isNaN(parsedEmployeeId)) {
    where.employeeId = parsedEmployeeId;
  }

  if (status) {
    where.status = status;
  }

  // Date filter
  if (date) {
    const filterDate = new Date(date);
    filterDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(filterDate);
    nextDay.setDate(nextDay.getDate() + 1);

    where.date = {
      gte: filterDate,
      lt: nextDay,
    };
  }

  // Location filter
  if (locationId) {
    const parsedLocationId = parseInt(locationId);
    if (!isNaN(parsedLocationId)) {
      where.locationId = parsedLocationId;
    }
  }

  try {
    const [attendanceRecords, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: pageSize,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePic: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.attendance.count({ where }),
    ]);

    return res.status(200).json({
      data: {
        attendance: attendanceRecords,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching attendance records", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const myAttendance = async (req, res) => {
  const employeeId = req.user.id;
  const companyId = req.user.companyId;

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 10);
  const skip = (page - 1) * limit;

  if (!employeeId || !companyId) {
    return res
      .status(400)
      .json({ message: "Employee ID and Company ID are required" });
  }

  try {
    const myattendance = await prisma.attendance.findMany({
      where: {
        employeeId,
        companyId,
      },
      orderBy: {
        date: "desc",
      },
      include: {
        employee: {
          select: {
            name: true,
            email: true,
            profilePic: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      skip,
      take: limit,
    });
    if (!myattendance || myattendance.length === 0) {
      return res.status(404).json({ message: "No attendance records found" });
    }

    return res.status(200).json({
      data: { attendance: myattendance },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(myattendance.length / limit),
        total: await prisma.attendance.count({
          where: { employeeId, companyId },
        }),
      },
    });
  } catch (error) {
    console.error("Error in myAttendance controller", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAttendanceStats = async (req, res) => {
  const employeeId = req.user?.id;
  const companyId = req.user?.companyId;

  if (!employeeId || !companyId) {
    return res
      .status(400)
      .json({ message: "Employee ID and Company ID are required" });
  }

  try {
    const [
      totalAttendance,
      totalDays,
      daysLate,
      daysAbsent,
      daysOnTime,
      daysEarly,
    ] = await Promise.all([
      prisma.attendance.count({
        where: { employeeId, companyId, status: { not: "ABSENT" } },
      }),
      prisma.attendance.count({
        where: { employeeId, companyId },
      }),
      prisma.attendance.count({
        where: { employeeId, companyId, status: "LATE" },
      }),
      prisma.attendance.count({
        where: { employeeId, companyId, status: "ABSENT" },
      }),
      prisma.attendance.count({
        where: { employeeId, companyId, status: "ON_TIME" },
      }),
      prisma.attendance.count({
        where: { employeeId, companyId, status: "EARLY" },
      }),
    ]);

    const attendancePercentage =
      totalDays > 0
        ? parseFloat(((totalAttendance / totalDays) * 100).toFixed(1))
        : 0;

    return res.status(200).json({
      data: {
        attendancePercentage,
        daysLate,
        daysAbsent,
        daysOnTime,
        daysEarly,
      },
    });
  } catch (error) {
    console.error("Error in getAttendanceStats controller", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getCompanyAttendanceStats = async (req, res) => {
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "Company ID is required" });
  }

  try {
    const [
      totalAttendance,
      totalDays,
      daysLate,
      daysAbsent,
      daysOnTime,
      daysEarly,
    ] = await Promise.all([
      prisma.attendance.count({
        where: { companyId, status: { not: "ABSENT" } },
      }),
      prisma.attendance.count({
        where: { companyId },
      }),
      prisma.attendance.count({
        where: { companyId, status: "LATE" },
      }),
      prisma.attendance.count({
        where: { companyId, status: "ABSENT" },
      }),
      prisma.attendance.count({
        where: { companyId, status: "ON_TIME" },
      }),
      prisma.attendance.count({
        where: { companyId, status: "EARLY" },
      }),
    ]);

    const attendancePercentage =
      totalDays > 0
        ? parseFloat(((totalAttendance / totalDays) * 100).toFixed(1))
        : 0;

    return res.status(200).json({
      data: {
        attendancePercentage,
        daysLate,
        daysAbsent,
        daysOnTime,
        daysEarly,
      },
    });
  } catch (error) {
    console.error("Error in getCompanyAttendanceStats controller", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const listSpecificEmployeeAttendance = async (req, res) => {
  const id = req.user.id;

  const { employeeId } = req.params;
  const { companyId } = req.user;

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 10);
  const skip = (page - 1) * limit;

  // Get location filter
  const { locationId } = req.query;

  if (!employeeId || !companyId) {
    return res
      .status(400)
      .json({ message: "Employee ID and Company ID are required" });
  }

  if (!id) {
    return res
      .status(400)
      .json({ message: "You are not authorized to access this resource" });
  }

  // Parse employeeId to integer
  const parsedEmployeeId = parseInt(employeeId);
  if (isNaN(parsedEmployeeId)) {
    return res.status(400).json({ message: "Invalid Employee ID format" });
  }

  try {
    // Build where clause with location filter
    const where = {
      employeeId: parsedEmployeeId,
      companyId,
    };

    // Add location filter if provided
    if (locationId) {
      const parsedLocationId = parseInt(locationId);
      if (!isNaN(parsedLocationId)) {
        where.locationId = parsedLocationId;
      }
    }

    const attendance = await prisma.attendance.findMany({
      where,
      orderBy: {
        date: "desc",
      },
      skip,
      take: limit,
      include: {
        employee: {
          select: {
            name: true,
            email: true,
            profilePic: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get total count for pagination
    const total = await prisma.attendance.count({ where });

    if (!attendance || attendance.length === 0) {
      return res.status(200).json({
        success: true,
        data: { attendance: [] },
        pagination: {
          page,
          limit,
          totalPages: 0,
          total: 0,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { attendance },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Error in listSpecificEmployeeAttendance controller", error);
    return res.status(500).json("Internal Server Error");
  }
};

export const viewEmployeeAttendanceStats = async (req, res) => {
  const companyId = req.user?.companyId;

  const { employeeId } = req.params;

  if (!employeeId || !companyId) {
    return res
      .status(400)
      .json({ message: "Employee ID and Company ID are required" });
  }

  // Convert employeeId to number for Prisma
  const parsedEmployeeId = parseInt(employeeId, 10);

  try {
    const [
      totalAttendance,
      totalDays,
      daysLate,
      daysAbsent,
      daysOnTime,
      daysEarly,
    ] = await Promise.all([
      prisma.attendance.count({
        where: {
          employeeId: parsedEmployeeId,
          companyId,
          status: { not: "ABSENT" },
        },
      }),
      prisma.attendance.count({
        where: { employeeId: parsedEmployeeId, companyId },
      }),
      prisma.attendance.count({
        where: { employeeId: parsedEmployeeId, companyId, status: "LATE" },
      }),
      prisma.attendance.count({
        where: { employeeId: parsedEmployeeId, companyId, status: "ABSENT" },
      }),
      prisma.attendance.count({
        where: { employeeId: parsedEmployeeId, companyId, status: "ON_TIME" },
      }),
      prisma.attendance.count({
        where: { employeeId: parsedEmployeeId, companyId, status: "EARLY" },
      }),
    ]);

    const attendancePercentage =
      totalDays > 0
        ? parseFloat(((totalAttendance / totalDays) * 100).toFixed(1))
        : 0;

    return res.status(200).json({
      data: {
        attendancePercentage,
        daysLate,
        daysAbsent,
        daysOnTime,
        daysEarly,
      },
    });
  } catch (error) {
    console.error("Error in getAttendanceStats controller", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
