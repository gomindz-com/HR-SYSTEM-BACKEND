import e from 'express';
import prisma from '../config/prisma.config.js'
import { determineAttendanceStatus } from '../lib/attendance-utils';
const DUPLICATE_WINDOWS = {
    CHECK_IN: 2,   // 2 minutes for check-in
    CHECK_OUT: 5   // 5 minutes for check-out (people might linger)
};


const findEmployeeByBiometricId = async (biometricUserId, companyId) => {
    return prisma.employee.findFirst({
        where: {
            biometricUserId,
            companyId
        },
        include: {
            shiftType: true
        }
    })
}





const getOrCreateAttendance = async (employeeId, companyId, deviceId, timestamp) => {
    const date = new Date(timestamp).setHours(0, 0, 0, 0);


    const company = await prisma.company.findUnique({
        where: {
            id: companyId
        },
        include: {
            companySettings: true
        }
    })

    const employee = await findEmployeeByBiometricId(biometricUserId, companyId);

    const companySettings = company.companySettings;
    const employeeShiftType = employee.shiftType;

    const attendanceStatus = determineAttendanceStatus(timestamp, companySettings, employeeShiftType);




    let attendance = await prisma.attendance.findUnique({
        where: {
            employeeId_date: {
                employeeId,
                date
            }
        }
    })




    // if doesnt exist create it

    if (!attendance) {
        attendance = await prisma.attendance.create({
            data: {
                employeeId,
                companyId,
                date,
                status: attendanceStatus,
            }
        })

        return attendance;
    }
}




/**
 * Check if this is a duplicate event (within 2 minutes)
 */
const isDuplicateEvent = (attendance, timestamp, eventType) => {
    const relevantTime = eventType === 'CHECK_IN'
        ? attendance.timeIn
        : attendance.timeOut;

    if (!relevantTime) return false;

    const diffMinutes = Math.abs(timestamp - new Date(relevantTime)) / 1000 / 60;
    const windowMinutes = DUPLICATE_WINDOWS[eventType];

    return diffMinutes < windowMinutes;
};


/**
 * Update attendance with check-in or check-out time
 */


const updateAttendanceTime = async (attendanceId, timestamp, eventType) => {
    const updateData = eventType === 'CHECK_IN' ? { timeIn: timestamp } : { timeOut: timestamp };


    return prisma.attendance.update({
        where: { id: attendanceId },
        data: updateData,
        include: {
            employee: {
                Select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        }
    })

}

/**
 * Record attendance from normalized event
 */

const recordAttendance = async (normalizedEvent) => {
    try {
        // find employee
        const employee = await findEmployeeByBiometricId(normalizedEvent.biometricUserId, normalizedEvent.companyId);

        if (!employee) {
            console.warn(
                `Employee not found for biometric user ID: ${normalizedEvent.biometricUserId}`
            )
            return null;
        }

        // get or  create today's attendance record
        const attendance = await getOrCreateAttendance(
            employee.id,
            normalizedEvent.companyId,
            normalizedEvent.deviceId,
            normalizedEvent.timestamp
        )

        // Check for duplicate


        if (isDuplicateEvent(attendance, normalizedEvent.timestamp, normalizedEvent.eventType)) {
            console.log(`[Attendance] Duplicate ${normalizedEvent.eventType} detected, skipping...`)
            return null;
        }



        //  update the time 

        const updatedAttendance = await updateAttendanceTime(attendance.id, normalizedEvent.timestamp, normalizedEvent.eventType);
        console.log(`[Attendance] Updated attendance for ${employee.name} at ${normalizedEvent.timestamp.toLocaleTimeString()}`)
        return updatedAttendance;

    } catch (error) {
        console.error(`[Attendance] Error recording attendance: ${error.message}`)
        return error;
    }
}

export {
    recordAttendance,
    findEmployeeByBiometricId,
    getOrCreateAttendance,
    isDuplicateEvent,
    updateAttendanceTime
}