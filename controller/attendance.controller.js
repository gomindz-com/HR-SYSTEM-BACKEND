import prisma from "../config/prisma.config.js";
import { verifyQrPayload } from "../lib/utils.js";

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

    return res.status(201).json({ message: "Check-in successful", attendance });
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
      .json({ message: "Check-out successful", attendance });
  } catch (error) {
    console.log("Error in Checkout Controller", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const generateQrToken = async (req, res) => {
  const token = generateQrJwt(req.user.id, req.user.companyId);
  return res.status(200).json({ qrToken: token });
};
