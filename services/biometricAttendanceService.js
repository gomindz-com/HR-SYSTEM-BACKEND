import prisma from '../config/prisma.config.js'
const DUPLICATE_WINDOWS = {
    CHECK_IN: 2,   // 2 minutes for check-in
    CHECK_OUT: 5   // 5 minutes for check-out (people might linger)
  };


const findEmployeeByBiometricId = async (biometricUserId, companyId) => {
    return prisma.employee.findFirst({
        where: {
            biometricUserId,
            companyId
        }
    })
}

// check if the attendance is duplicate

const isDuplicateEvent = (attendance, timestamp, eventType) => {
    const relevantTime = eventType === 'CHECK_IN' 
      ? attendance.timeIn 
      : attendance.timeOut;
    
    if (!relevantTime) return false;
    
    const diffMinutes = Math.abs(timestamp - new Date(relevantTime)) / 1000 / 60;
    const windowMinutes = DUPLICATE_WINDOWS[eventType];
    
    return diffMinutes < windowMinutes;
  };


