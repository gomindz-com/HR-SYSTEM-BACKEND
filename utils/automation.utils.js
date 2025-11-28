import prisma from "../config/prisma.config.js";

export const isWorkday = (today, config) => {
  const dayOfWeek = today.getDay();

  const workDays = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };

  const dayName = workDays[dayOfWeek];
  return config && config[dayName] === true;
};

export const isEmployeeWorkday = async (today, employeeId, companyId) => {
  try {
    // Step 1: Check if employee has custom workday configuration
    const employeeConfig = await prisma.employeeWorkDaysConfig.findFirst({
      where: {
        employeeId: employeeId,
      },
    });

    if (employeeConfig) {
      // Employee has custom workdays - use them
      return isWorkday(today, employeeConfig);
    }

    // Step 2: Fallback to company workday configuration (default for employees)
    const companyConfig = await prisma.workdayDaysConfig.findFirst({
      where: {
        companyId: companyId,
      },
    });

    if (companyConfig) {
      // Use company workdays as default for employees without custom config
      return isWorkday(today, companyConfig);
    }

    // Step 3: Final fallback - default workdays (Mon-Fri) if company has no config
    const defaultConfig = {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    };

    return isWorkday(today, defaultConfig);
  } catch (error) {
    console.error("Error in isEmployeeWorkday", error);

    // on error just default to mon-fri

    const defaultConfig = {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    };

    return isWorkday(today, defaultConfig);
  }
};
