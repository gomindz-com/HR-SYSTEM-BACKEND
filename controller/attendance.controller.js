import prisma from "../config/prisma.config.js";
import { verifyQrPayload , generateQrJwt} from "../lib/utils.js";
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
  const companyId = req.user.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "Company ID is required" });
  }

  // Pagination params
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const skip = (page - 1) * pageSize;

  // Filtering params
  const { employeeId, status, fromDate, toDate } = req.query;

  // Build where clause
  const where = { companyId };
  if (employeeId) where.employeeId = parseInt(employeeId);
  if (status) where.status = status;
  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = new Date(fromDate);
    if (toDate) where.date.lte = new Date(toDate);
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
}