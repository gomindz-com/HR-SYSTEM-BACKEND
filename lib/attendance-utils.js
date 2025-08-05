import { format, isAfter, isBefore, addMinutes } from "date-fns";

/**
 * Get current time in UTC (universal for everyone)
 * @returns {Date} Current time in UTC
 */
export const getCurrentTimeInTimezone = () => {
  return new Date();
};

/**
 * Parse time string (HH:MM) and convert to Date object in UTC
 * @param {string} timeString - Time in HH:MM format (e.g., "09:00")
 * @param {Date} date - Date to attach the time to (defaults to today)
 * @returns {Date} Date object with the specified time in UTC
 */
export const parseTimeInTimezone = (timeString, date = new Date()) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

/**
 * Check if current time is within check-in window
 * @param {Object} companySettings - Company attendance settings
 * @returns {Object} Check result with isAllowed, reason, and current time info
 */
export const checkCheckInWindow = (companySettings) => {
  const {
    workStartTime = "09:00",
    workEndTime = "17:00",
    checkInDeadline = 15,
  } = companySettings;

  const now = getCurrentTimeInTimezone();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Parse work times
  const workStart = parseTimeInTimezone(workStartTime, today);
  const workEnd = parseTimeInTimezone(workEndTime, today);
  const deadline = addMinutes(workEnd, checkInDeadline);

  // Allow check-in 30 minutes before work start time
  const earlyCheckInTime = addMinutes(workStart, -30); // 30 minutes before work start

  if (isBefore(now, earlyCheckInTime)) {
    return {
      isAllowed: false,
      reason: `Check-in is not allowed before ${format(earlyCheckInTime, "HH:mm")} (30 minutes before work start)`,
      currentTime: format(now, "HH:mm"),
      workStartTime,
      workEndTime,
      deadline: format(deadline, "HH:mm"),
    };
  }

  // Check if current time is after deadline
  if (isAfter(now, deadline)) {
    return {
      isAllowed: false,
      reason: `Check-in deadline has passed (${format(deadline, "HH:mm")})`,
      currentTime: format(now, "HH:mm"),
      workStartTime,
      workEndTime,
      deadline: format(deadline, "HH:mm"),
    };
  }

  return {
    isAllowed: true,
    reason: "Check-in allowed",
    currentTime: format(now, "HH:mm"),
    workStartTime,
    workEndTime,
    deadline: format(deadline, "HH:mm"),
  };
};

/**
 * Check if current time is within check-out window
 * @param {Object} companySettings - Company attendance settings
 * @returns {Object} Check result with isAllowed, reason, and current time info
 */
export const checkCheckOutWindow = (companySettings) => {
  // Allow flexible check-out - no time restrictions
  const now = getCurrentTimeInTimezone();

  return {
    isAllowed: true,
    reason: "Check-out allowed",
    currentTime: format(now, "HH:mm"),
  };
};

/**
 * Determine attendance status based on check-in time
 * @param {Date} checkInTime - When employee checked in
 * @param {Object} companySettings - Company attendance settings
 * @returns {string} Attendance status ('ON_TIME' or 'LATE')
 */
export const determineAttendanceStatus = (checkInTime, companySettings) => {
  const { workStartTime = "09:00", lateThreshold = 15 } = companySettings;

  const today = new Date(checkInTime);
  today.setHours(0, 0, 0, 0);

  const workStart = parseTimeInTimezone(workStartTime, today);
  const lateThresholdTime = addMinutes(workStart, lateThreshold);

  return isAfter(checkInTime, lateThresholdTime) ? "LATE" : "ON_TIME";
};

/**
 * Format time for display in UTC
 * @param {Date} date - Date to format
 * @param {string} formatString - Date-fns format string
 * @returns {string} Formatted time string
 */
export const formatTimeInTimezone = (date, formatString = "HH:mm") => {
  return format(date, formatString);
};
