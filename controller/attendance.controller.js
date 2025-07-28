import prisma from "../config/prisma.config.js";
import { verifyQrPayload, generateQrJwt } from "../lib/utils.js";
export const checkIn = async (req, res) => {
  const { qrPayload } = req.body;
  const employeeId = req.user.id;
  const companyId = req.user.companyId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  try {
    const qrData = verifyQrPayload(qrPayload);
    if (!qrData) {
      return res.status(400).json({ message: "Invalid or expired QR code" });
    }
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

    const now = new Date();
    const status = now.getHours() >= 9 ? "LATE" : "PRESENT";

    // Use upsert to avoid unique constraint issues
    const attendance = await prisma.attendance.upsert({
      where: {
        employeeId_date: { employeeId, date: today },
      },
      update: {
        timeIn: now,
        status,
      },
      create: {
        employeeId,
        companyId,
        date: today,
        timeIn: now,
        status,
      },
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
  const { qrPayload } = req.body;
  const employeeId = req.user.id;
  const companyId = req.user.companyId;

  try {
    const qrData = verifyQrPayload(qrPayload);
    if (!qrData) {
      return res.status(400).json({ message: "Invalid or expired QR code" });
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

    if (!existingAttendance || existingAttendance.timeOut) {
      return res.status(400).json({ message: "You have not checked in today" });
    }

    const now = new Date();
    const attendance = await prisma.attendance.update({
      where: { id: existingAttendance.id },
      data: { timeOut: now },
    });

    return res
      .status(200)
      .json({ message: "Check-out successful", data: { attendance } });
  } catch (error) {
    console.log("Error in Checkout Controller", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const generateQrToken = async (req, res) => {
  const token = generateQrJwt(req.user.companyId);
  return res.status(200).json({ data: { qrToken: token } });
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
  const { employeeId, status } = req.query;
  const where = { companyId };

  // Safe parse for employeeId
  const parsedEmployeeId = parseInt(employeeId);
  if (employeeId && !isNaN(parsedEmployeeId)) {
    where.employeeId = parsedEmployeeId;
  }

  if (status) {
    where.status = status;
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
  } catch (error) {}
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
    ]);

    const attendancePercentage =
      totalDays > 0
        ? parseFloat(((totalAttendance / totalDays) * 100).toFixed(1))
        : 0;

    return res.status(200).json({
      data: { attendancePercentage, daysLate, daysAbsent },
    });
  } catch (error) {
    console.error("Error in getAttendanceStats controller", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
