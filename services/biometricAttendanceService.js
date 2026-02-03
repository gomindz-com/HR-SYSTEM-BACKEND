// attendanceService.js - UPDATED
import prisma from '../config/prisma.config.js';
import { determineAttendanceStatus } from '../lib/attendance-utils.js';

const DUPLICATE_WINDOWS = {
    CHECK_IN: 2,   // 2 minutes
    CHECK_OUT: 5   // 5 minutes
};

const findEmployeeByBiometricId = async (biometricUserId, companyId) => {
    return prisma.employee.findFirst({
        where: { biometricUserId, companyId },
        include: { shiftType: true }
    });
};

const getOrCreateAttendance = async (employeeId, companyId, timestamp) => {
    // Ensure we are looking at the correct calendar date (midnight)
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);

    const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { companySettings: true }
    });

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { shiftType: true }
    });

    // Fix: determineAttendanceStatus needs the actual objects
    const attendanceStatus = determineAttendanceStatus(timestamp, company.companySettings, employee.shiftType);

    let attendance = await prisma.attendance.findUnique({
        where: {
            employeeId_date: { employeeId, date }
        }
    });

    if (!attendance) {
        attendance = await prisma.attendance.create({
            data: {
                employeeId,
                companyId,
                date,
                status: attendanceStatus,
            }
        });
    }
    return attendance;
};

const isDuplicateEvent = (attendance, timestamp, eventType) => {
    const relevantTime = eventType === 'CHECK_IN' ? attendance.timeIn : attendance.timeOut;
    if (!relevantTime) return false;

    const diffMinutes = Math.abs(new Date(timestamp) - new Date(relevantTime)) / 1000 / 60;
    return diffMinutes < DUPLICATE_WINDOWS[eventType];
};

const updateAttendanceTime = async (attendanceId, timestamp, eventType) => {
    const updateData = eventType === 'CHECK_IN' ? { timeIn: timestamp } : { timeOut: timestamp };

    return prisma.attendance.update({
        where: { id: attendanceId },
        data: updateData
    });
};

const recordAttendance = async (normalizedEvent) => {
    try {
        const employee = await findEmployeeByBiometricId(normalizedEvent.biometricUserId, normalizedEvent.companyId);

        if (!employee) {
            console.warn(`[Attendance] No employee for BioID: ${normalizedEvent.biometricUserId}`);
            return null;
        }

        const attendance = await getOrCreateAttendance(
            employee.id,
            normalizedEvent.companyId,
            normalizedEvent.timestamp
        );

        if (isDuplicateEvent(attendance, normalizedEvent.timestamp, normalizedEvent.eventType)) {
            return null;
        }

        const updated = await updateAttendanceTime(attendance.id, normalizedEvent.timestamp, normalizedEvent.eventType);

        // 2026 Health Update: Every punch confirms the device is alive
        await prisma.biometricDevice.update({
            where: { id: normalizedEvent.deviceId },
            data: { lastSeen: new Date() }
        });

        return updated;
    } catch (error) {
        console.error(`[Attendance] Error: ${error.message}`);
        return null;
    }
};

export { recordAttendance };