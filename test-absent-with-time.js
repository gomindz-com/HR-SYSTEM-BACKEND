#!/usr/bin/env node
/**
 * Test script with time simulation for absent automation
 * Allows testing different time scenarios without waiting
 */

import { hasShiftDeadlinePassed } from "./lib/attendance-utils.js";
import prisma from "./config/prisma.config.js";
import { addMinutes, format, parseISO, isValid } from "date-fns";

const COMPANY_ID = process.argv[2] ? parseInt(process.argv[2]) : null;
// Simulate time: format "YYYY-MM-DDTHH:mm:ss" or "now" for current time
const SIMULATED_TIME = process.argv[3] || "now";

async function testWithSimulatedTime() {
  console.log("🕐 Testing Absent Automation with Simulated Time");
  console.log("=".repeat(70));

  if (!COMPANY_ID) {
    console.log("\n💡 Usage: node test-absent-with-time.js <companyId> [simulatedTime]");
    console.log("   Examples:");
    console.log("   node test-absent-with-time.js 1 now");
    console.log("   node test-absent-with-time.js 1 2025-01-16T18:00:00");
    console.log("   node test-absent-with-time.js 1 2025-01-16T00:20:00");
    process.exit(0);
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: COMPANY_ID },
      select: {
        id: true,
        companyName: true,
        timezone: true,
        workStartTime: true,
        workEndTime: true,
        workStartTime2: true,
        workEndTime2: true,
        checkInDeadline: true,
        checkInDeadline2: true,
        lateThreshold: true,
        lateThreshold2: true,
      },
    });

    if (!company) {
      console.error(`❌ Company with ID ${COMPANY_ID} not found`);
      process.exit(1);
    }

    // Parse simulated time
    let simulatedTime;
    if (SIMULATED_TIME === "now") {
      simulatedTime = new Date();
    } else {
      simulatedTime = parseISO(SIMULATED_TIME);
      if (!isValid(simulatedTime)) {
        console.error(`❌ Invalid time format: ${SIMULATED_TIME}`);
        console.log("   Use format: YYYY-MM-DDTHH:mm:ss (e.g., 2025-01-16T18:00:00)");
        process.exit(1);
      }
    }

    console.log(`\n📋 Company: ${company.companyName}`);
    console.log(`   Timezone: ${company.timezone}`);
    console.log(`   Simulated Time: ${simulatedTime.toISOString()}`);
    console.log(`   Simulated Time (Local): ${simulatedTime.toLocaleString()}`);

    // Calculate yesterday's date based on simulated time
    const todayLocalDateString = simulatedTime.toLocaleDateString("en-CA", {
      timeZone: company.timezone,
    });
    const todayLocalDate = new Date(`${todayLocalDateString}T00:00:00`);
    const yesterdayLocalDate = new Date(todayLocalDate);
    yesterdayLocalDate.setDate(yesterdayLocalDate.getDate() - 1);
    const yesterdayDateString = yesterdayLocalDate.toLocaleDateString("en-CA", {
      timeZone: company.timezone,
    });
    const yesterdayMidnight = new Date(`${yesterdayDateString}T00:00:00.000Z`);

    console.log(`\n📅 Date Information (based on simulated time):`);
    console.log(`   Today (local): ${todayLocalDateString}`);
    console.log(`   Yesterday (local): ${yesterdayDateString}`);

    // Get employees
    const employees = await prisma.employee.findMany({
      where: {
        companyId: COMPANY_ID,
        status: "ACTIVE",
        emailVerified: true,
        deleted: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        shiftType: true,
      },
      orderBy: { name: "asc" },
    });

    const morningEmployees = employees.filter((e) => !e.shiftType || e.shiftType === "MORNING_SHIFT");
    const eveningEmployees = employees.filter((e) => e.shiftType === "EVENING_SHIFT");

    console.log(`\n👥 Employees:`);
    console.log(`   Morning Shift: ${morningEmployees.length}`);
    morningEmployees.forEach((emp) => {
      console.log(`     - ${emp.name}`);
    });
    console.log(`   Evening Shift: ${eveningEmployees.length}`);
    eveningEmployees.forEach((emp) => {
      console.log(`     - ${emp.name}`);
    });

    // Check attendance records for yesterday
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        companyId: COMPANY_ID,
        date: {
          gte: yesterdayMidnight,
          lt: new Date(yesterdayMidnight.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: {
        employee: {
          select: { name: true, shiftType: true },
        },
      },
    });

    console.log(`\n📊 Attendance Records for ${yesterdayDateString}:`);
    if (attendanceRecords.length > 0) {
      attendanceRecords.forEach((record) => {
        console.log(`   - ${record.employee.name} (${record.employee.shiftType || "MORNING_SHIFT"}): ${record.status}`);
      });
    } else {
      console.log("   No attendance records");
    }

    // Find employees without attendance
    const employeesWithoutAttendance = await prisma.employee.findMany({
      where: {
        companyId: COMPANY_ID,
        status: "ACTIVE",
        emailVerified: true,
        deleted: false,
        attendances: {
          none: {
            date: {
              gte: yesterdayMidnight,
              lt: new Date(yesterdayMidnight.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        shiftType: true,
      },
    });

    console.log(`\n🔍 Employees Without Attendance (${employeesWithoutAttendance.length}):`);
    employeesWithoutAttendance.forEach((emp) => {
      const shiftType = emp.shiftType || "MORNING_SHIFT";
      console.log(`   - ${emp.name} (${shiftType})`);
    });

    // Calculate deadlines
    console.log(`\n⏰ Deadline Analysis (at simulated time):`);

    // Morning shift deadline
    const today = new Date(simulatedTime);
    today.setHours(0, 0, 0, 0);

    const morningWorkEnd = new Date(`${yesterdayDateString}T${company.workEndTime}:00`);
    const morningDeadline = addMinutes(morningWorkEnd, company.checkInDeadline);
    const morningDeadlinePassed = hasShiftDeadlinePassed(
      company,
      "MORNING_SHIFT",
      simulatedTime
    );

    console.log(`\n   Morning Shift:`);
    console.log(`   - Work End: ${format(morningWorkEnd, "yyyy-MM-dd HH:mm")}`);
    console.log(`   - Deadline: ${format(morningDeadline, "yyyy-MM-dd HH:mm")} (+${company.checkInDeadline} min)`);
    console.log(`   - Deadline Passed: ${morningDeadlinePassed ? "✅ YES" : "❌ NO"}`);

    // Evening shift deadline
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const eveningWorkEnd = new Date(`${yesterdayDateString}T${company.workEndTime2}:00`);
    const eveningDeadline = addMinutes(eveningWorkEnd, company.checkInDeadline2);
    const eveningDeadlinePassed = hasShiftDeadlinePassed(
      company,
      "EVENING_SHIFT",
      simulatedTime
    );

    console.log(`\n   Evening Shift:`);
    console.log(`   - Work End: ${format(eveningWorkEnd, "yyyy-MM-dd HH:mm")}`);
    console.log(`   - Deadline: ${format(eveningDeadline, "yyyy-MM-dd HH:mm")} (+${company.checkInDeadline2} min)`);
    console.log(`   - Deadline Passed: ${eveningDeadlinePassed ? "✅ YES" : "❌ NO"}`);

    // Test each employee
    console.log(`\n🎯 Employees That Would Be Marked Absent:`);
    let morningCount = 0;
    let eveningCount = 0;

    employeesWithoutAttendance.forEach((emp) => {
      const shiftType = emp.shiftType || "MORNING_SHIFT";
      const deadlinePassed = hasShiftDeadlinePassed(company, shiftType, simulatedTime);
      
      if (deadlinePassed) {
        if (shiftType === "MORNING_SHIFT") {
          morningCount++;
        } else {
          eveningCount++;
        }
        console.log(`   ✅ ${emp.name} (${shiftType}) - Deadline passed`);
      } else {
        console.log(`   ⏳ ${emp.name} (${shiftType}) - Deadline NOT passed yet`);
      }
    });

    console.log(`\n📊 Summary:`);
    console.log(`   Morning shift employees to mark: ${morningCount}`);
    console.log(`   Evening shift employees to mark: ${eveningCount}`);
    console.log(`   Total: ${morningCount + eveningCount}`);

    if (morningCount === 0 && eveningCount === 0 && employeesWithoutAttendance.length > 0) {
      console.log(`\n💡 Tip: Adjust the simulated time to test deadlines:`);
      console.log(`   - For morning: Use time after ${format(morningDeadline, "HH:mm")}`);
      console.log(`   - For evening: Use time after ${format(eveningDeadline, "HH:mm")} (next day)`);
      console.log(`   Example: node test-absent-with-time.js ${COMPANY_ID} ${format(addMinutes(eveningDeadline, 1), "yyyy-MM-dd'T'HH:mm:ss")}`);
    }

  } catch (error) {
    console.error("\n💥 Error:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testWithSimulatedTime();

