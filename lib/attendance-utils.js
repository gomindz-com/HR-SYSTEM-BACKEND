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

export const hasShiftDeadlinePassed = (
  companySettings,
  employeeShiftType,
  currentTime = new Date(),
  checkDate = null // Optional: date to check against (for automation checking yesterday)
) => {
  const {
    workEndTime = "17:00",
    checkInDeadline = 15,
    workEndTime2 = "23:59",
    checkInDeadline2 = 15,
  } = companySettings;

  const today = new Date(currentTime);
  today.setHours(0, 0, 0, 0);

  let workEnd, deadline;

  if (employeeShiftType === "EVENING_SHIFT") {
    // For evening shift, the deadline is based on yesterday's shift end
    // Example: If current time is 2025-01-16 00:30, we check if yesterday's
    // deadline (2025-01-15 23:59 + 15 min = 2025-01-16 00:14) has passed
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    workEnd = parseTimeInTimezone(workEndTime2, yesterday);
    deadline = addMinutes(workEnd, checkInDeadline2);
  } else {
    // For morning shift, use checkDate if provided (for automation checking yesterday),
    // otherwise use today (for real-time checks during the day)
    const dateToUse = checkDate ? new Date(checkDate) : today;
    workEnd = parseTimeInTimezone(workEndTime, dateToUse);
    deadline = addMinutes(workEnd, checkInDeadline);
  }

  // If deadline wrapped around (shouldn't happen for morning shift, but handle it)
  if (deadline < workEnd) {
    deadline = addMinutes(deadline, 24 * 60);
  }

  return isAfter(currentTime, deadline);
};

export const checkCheckInWindow = (companySettings, employeeShiftType) => {
  const {
    workStartTime = "09:00",
    workEndTime = "17:00",
    checkInDeadline = 15,
    checkInDeadline2 = 15,
    workStartTime2 = "17:00",
    workEndTime2 = "23:59",
  } = companySettings;

  const now = getCurrentTimeInTimezone();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  let workStart, workEnd, deadline, earlyCheckInTime;

  if (employeeShiftType === "EVENING_SHIFT") {
    workStart = parseTimeInTimezone(workStartTime2, today);
    workEnd = parseTimeInTimezone(workEndTime2, today);
    deadline = addMinutes(workEnd, checkInDeadline2);
    earlyCheckInTime = addMinutes(workStart, -180); // 3hrs before evening shift start
  } else {
    workStart = parseTimeInTimezone(workStartTime, today);
    workEnd = parseTimeInTimezone(workEndTime, today);
    deadline = addMinutes(workEnd, checkInDeadline);
    earlyCheckInTime = addMinutes(workStart, -180); // 3hrs before morning shift start
  }

  // Check if too early
  if (isBefore(now, earlyCheckInTime)) {
    return {
      isAllowed: false,
      reason: `Check-in opens at ${format(earlyCheckInTime, "HH:mm")}. Please try again later.`,
      currentTime: format(now, "HH:mm"),
      workStartTime: format(workStart, "HH:mm"),
      workEndTime: format(workEnd, "HH:mm"),
      deadline: format(deadline, "HH:mm"),
    };
  }

  // Check if after deadline
  if (isAfter(now, deadline)) {
    return {
      isAllowed: false,
      reason: `Check-in deadline has passed (${format(deadline, "HH:mm")})`,
      currentTime: format(now, "HH:mm"),
      workStartTime: format(workStart, "HH:mm"),
      workEndTime: format(workEnd, "HH:mm"),
      deadline: format(deadline, "HH:mm"),
    };
  }

  return {
    isAllowed: true,
    reason: "Check-in allowed",
    currentTime: format(now, "HH:mm"),
    workStartTime: format(workStart, "HH:mm"),
    workEndTime: format(workEnd, "HH:mm"),
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
 * @param {string} employeeShiftType - Type of shift (MORNING_SHIFT or EVENING_SHIFT)
 * @returns {string} Attendance status ('EARLY', 'ON_TIME', or 'LATE')
 */
export const determineAttendanceStatus = (
  checkInTime,
  companySettings,
  employeeShiftType
) => {
  let workStartTime, lateThreshold;

  if (employeeShiftType === "EVENING_SHIFT") {
    workStartTime = companySettings.workStartTime2;
    lateThreshold = companySettings.lateThreshold2;
  } else {
    workStartTime = companySettings.workStartTime;
    lateThreshold = companySettings.lateThreshold;
  }

  const today = new Date(checkInTime);
  today.setHours(0, 0, 0, 0);

  const workStart = parseTimeInTimezone(workStartTime, today);
  const earlyThreshold = addMinutes(workStart, -15); // 15 minutes before work start
  const lateThresholdTime = addMinutes(workStart, lateThreshold);

  // Check if employee checked in early (more than 15 minutes before work start)
  if (isBefore(checkInTime, earlyThreshold)) {
    return "EARLY";
  }

  // Check if employee checked in late (after late threshold)
  if (isAfter(checkInTime, lateThresholdTime)) {
    return "LATE";
  }

  // Employee checked in on time (within 15 minutes before work start to late threshold)
  return "ON_TIME";
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
