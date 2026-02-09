// attendanceService.js - UPDATED
import prisma from '../config/prisma.config.js';
import { determineAttendanceStatus } from '../lib/attendance-utils.js';

const DUPLICATE_WINDOWS = {
    CHECK_IN: 2,   // 2 minutes
    CHECK_OUT: 5   // 5 minutes
};

const findEmployeeByBiometricId = async (biometricUserId, companyId) => {
    return prisma.employee.findFirst({
        where: { biometricUserId, companyId }
    });
};

const getOrCreateAttendance = async (employeeId, companyId, timestamp, deviceId) => {
    // Ensure we are looking at the correct calendar date (midnight)
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);

    const company = await prisma.company.findUnique({
        where: { id: companyId }
    });
    if (!company) throw new Error("Company not found");

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId }
    });
    if (!employee) throw new Error("Employee not found");

    // Company has workStartTime, workEndTime, lateThreshold etc. directly
    const attendanceStatus = determineAttendanceStatus(timestamp, company, employee.shiftType);

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
                deviceId: deviceId || undefined,
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
            normalizedEvent.timestamp,
            normalizedEvent.deviceId
        );

        // First punch = check-in, second = check-out, third+ = skip (device sends all as punch)
        const hasCheckIn = !!attendance.timeIn;
        const hasCheckOut = !!attendance.timeOut;
        let eventType;
        if (!hasCheckIn) {
            eventType = 'CHECK_IN';
        } else if (!hasCheckOut) {
            eventType = 'CHECK_OUT';
        } else {
            // Already have both in and out for today — ignore further punches
            return null;
        }

        if (isDuplicateEvent(attendance, normalizedEvent.timestamp, eventType)) {
            return null;
        }

        const updatePayload = eventType === 'CHECK_IN'
            ? { timeIn: normalizedEvent.timestamp, deviceId: normalizedEvent.deviceId }
            : { timeOut: normalizedEvent.timestamp };
        const updated = await prisma.attendance.update({
            where: { id: attendance.id },
            data: updatePayload
        });

        console.log(`[Attendance] Recorded ${eventType} for employee ${employee.id} (${employee.name}) at ${normalizedEvent.timestamp.toISOString()}`);

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