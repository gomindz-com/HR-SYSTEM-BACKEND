#!/usr/bin/env node
/**
 * Test script for absent automation with real database data
 * Tests the shift-aware absent marking functionality
 */

import { manuallyTriggerForCompany } from "./automations/absentAutomation.js";
import { hasShiftDeadlinePassed } from "./lib/attendance-utils.js";
import prisma from "./config/prisma.config.js";
import { addMinutes, format, isAfter } from "date-fns";

// Get company ID from command line or use first company
const COMPANY_ID = process.argv[2] ? parseInt(process.argv[2]) : null;
const DRY_RUN = process.argv[3] !== "execute"; // Default to dry-run unless "execute" is passed

async function testAbsentAutomation() {
  console.log("🧪 Testing Absent Automation with Real Data");
  console.log("=".repeat(70));

  try {
    // Get company info
    let company;
    if (COMPANY_ID) {
      company = await prisma.company.findUnique({
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
    } else {
      // List all companies
      const companies = await prisma.company.findMany({
        select: { id: true, companyName: true, timezone: true },
      });

      if (companies.length === 0) {
        console.error("❌ No companies found in database");
        process.exit(1);
      }

      console.log("\n📋 Available Companies:");
      companies.forEach((c) => {
        console.log(`   ${c.id}. ${c.companyName} (${c.timezone})`);
      });

      console.log("\n💡 Usage: node test-absent-real.js <companyId> [execute]");
      console.log("   Example: node test-absent-real.js 1        (dry run)");
      console.log("   Example: node test-absent-real.js 1 execute (actual)");
      process.exit(0);
    }

    if (!company) {
      console.error(`❌ Company with ID ${COMPANY_ID} not found`);
      process.exit(1);
    }

    console.log(`\n📋 Company Info:`);
    console.log(`   ID: ${company.id}`);
    console.log(`   Name: ${company.companyName}`);
    console.log(`   Timezone: ${company.timezone}`);
    console.log(`\n📅 Morning Shift Settings:`);
    console.log(`   Start: ${company.workStartTime}`);
    console.log(`   End: ${company.workEndTime}`);
    console.log(`   Late Threshold: ${company.lateThreshold} minutes`);
    console.log(
      `   Check-in Deadline: ${company.checkInDeadline} minutes after end`
    );
    console.log(`\n🌙 Evening Shift Settings:`);
    console.log(`   Start: ${company.workStartTime2}`);
    console.log(`   End: ${company.workEndTime2}`);
    console.log(`   Late Threshold: ${company.lateThreshold2} minutes`);
    console.log(
      `   Check-in Deadline: ${company.checkInDeadline2} minutes after end`
    );

    // Get employees
    const employees = await prisma.employee.findMany({
      where: {
        companyId: company.id,
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

    console.log(`\n👥 Employees (${employees.length} total):`);
    const morning = employees.filter(
      (e) => !e.shiftType || e.shiftType === "MORNING_SHIFT"
    );
    const evening = employees.filter((e) => e.shiftType === "EVENING_SHIFT");
    console.log(`   Morning Shift: ${morning.length}`);
    console.log(`   Evening Shift: ${evening.length}`);

    // Calculate yesterday's date
    const now = new Date();
    const todayLocalDateString = now.toLocaleDateString("en-CA", {
      timeZone: company.timezone,
    });
    const todayLocalDate = new Date(`${todayLocalDateString}T00:00:00`);
    const yesterdayLocalDate = new Date(todayLocalDate);
    yesterdayLocalDate.setDate(yesterdayLocalDate.getDate() - 1);
    const yesterdayDateString = yesterdayLocalDate.toLocaleDateString("en-CA", {
      timeZone: company.timezone,
    });
    const yesterdayMidnight = new Date(`${yesterdayDateString}T00:00:00.000Z`);

    console.log(`\n📅 Date Information:`);
    console.log(`   Today (local): ${todayLocalDateString}`);
    console.log(`   Yesterday (local): ${yesterdayDateString}`);
    console.log(`   Current Time (UTC): ${now.toISOString()}`);

    // Get yesterday's attendance records
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        companyId: company.id,
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
      orderBy: { employee: { name: "asc" } },
    });

    console.log(
      `\n📊 Yesterday's Attendance Records (${attendanceRecords.length}):`
    );
    if (attendanceRecords.length > 0) {
      attendanceRecords.forEach((record) => {
        console.log(
          `   - ${record.employee.name} (${record.employee.shiftType || "MORNING_SHIFT"}): ${record.status}`
        );
      });
    } else {
      console.log("   No attendance records found for yesterday");
    }

    // Find employees without attendance
    const employeesWithoutAttendance = await prisma.employee.findMany({
      where: {
        companyId: company.id,
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
      orderBy: { name: "asc" },
    });

    console.log(
      `\n🔍 Employees Without Attendance (${employeesWithoutAttendance.length}):`
    );
    if (employeesWithoutAttendance.length > 0) {
      employeesWithoutAttendance.forEach((emp) => {
        const shiftType = emp.shiftType || "MORNING_SHIFT";
        console.log(`   - ${emp.name} (${shiftType})`);
      });
    } else {
      console.log("   All employees have attendance records");
    }

    // Calculate deadlines for each shift
    console.log(`\n⏰ Shift Deadline Analysis:`);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Morning shift deadline
    const morningWorkEnd = new Date(
      `${yesterdayDateString}T${company.workEndTime}:00`
    );
    const morningDeadline = addMinutes(morningWorkEnd, company.checkInDeadline);
    const morningDeadlinePassed = isAfter(now, morningDeadline);

    console.log(`\n   Morning Shift Deadline:`);
    console.log(`   - Work End: ${format(morningWorkEnd, "yyyy-MM-dd HH:mm")}`);
    console.log(
      `   - Deadline: ${format(morningDeadline, "yyyy-MM-dd HH:mm")} (+${company.checkInDeadline} min)`
    );
    console.log(
      `   - Deadline Passed: ${morningDeadlinePassed ? "✅ YES" : "❌ NO"}`
    );

    // Evening shift deadline
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const eveningWorkEnd = new Date(
      `${yesterdayDateString}T${company.workEndTime2}:00`
    );
    const eveningDeadline = addMinutes(
      eveningWorkEnd,
      company.checkInDeadline2
    );
    const eveningDeadlinePassed = isAfter(now, eveningDeadline);

    console.log(`\n   Evening Shift Deadline:`);
    console.log(`   - Work End: ${format(eveningWorkEnd, "yyyy-MM-dd HH:mm")}`);
    console.log(
      `   - Deadline: ${format(eveningDeadline, "yyyy-MM-dd HH:mm")} (+${company.checkInDeadline2} min)`
    );
    console.log(
      `   - Deadline Passed: ${eveningDeadlinePassed ? "✅ YES" : "❌ NO"}`
    );

    // Filter employees by deadline
    const employeesToMarkAbsent = employeesWithoutAttendance.filter(
      (employee) => {
        const shiftType = employee.shiftType || "MORNING_SHIFT";
        return hasShiftDeadlinePassed(company, shiftType, now);
      }
    );

    console.log(
      `\n🎯 Employees That Will Be Marked Absent (${employeesToMarkAbsent.length}):`
    );
    if (employeesToMarkAbsent.length > 0) {
      employeesToMarkAbsent.forEach((emp) => {
        const shiftType = emp.shiftType || "MORNING_SHIFT";
        const deadlinePassed = hasShiftDeadlinePassed(company, shiftType, now);
        console.log(
          `   ✅ ${emp.name} (${shiftType}) - Deadline passed: ${deadlinePassed}`
        );
      });
    } else {
      console.log("   No employees meet the criteria to be marked absent");
      if (employeesWithoutAttendance.length > 0) {
        console.log(
          "\n   ⚠️  Note: Some employees don't have attendance, but their deadlines haven't passed yet."
        );
        employeesWithoutAttendance.forEach((emp) => {
          const shiftType = emp.shiftType || "MORNING_SHIFT";
          const deadlinePassed = hasShiftDeadlinePassed(
            company,
            shiftType,
            now
          );
          console.log(
            `   - ${emp.name} (${shiftType}): Deadline passed = ${deadlinePassed}`
          );
        });
      }
    }

    // Check workday configuration
    const workdayConfig = await prisma.workdayDaysConfig.findFirst({
      where: { companyId: company.id },
    });

    const workdayDays = workdayConfig || {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    };

    const dayOfWeek = yesterdayLocalDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const dayName = dayNames[dayOfWeek];
    const isWorkday = [
      workdayDays.sunday,
      workdayDays.monday,
      workdayDays.tuesday,
      workdayDays.wednesday,
      workdayDays.thursday,
      workdayDays.friday,
      workdayDays.saturday,
    ][dayOfWeek];

    console.log(`\n📅 Workday Check:`);
    console.log(`   Yesterday was: ${dayName}`);
    console.log(`   Is Workday: ${isWorkday ? "✅ YES" : "❌ NO"}`);

    // Run the automation
    console.log(
      `\n${DRY_RUN ? "🧪 DRY RUN MODE" : "⚠️  LIVE MODE"} - Running automation...`
    );
    console.log("=".repeat(70));

    const result = await manuallyTriggerForCompany(
      company.id,
      company.timezone,
      DRY_RUN
    );

    console.log(`\n📊 Result:`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Message: ${result.message}`);
    console.log(
      `   Count: ${result.count || 0} employees ${DRY_RUN ? "would be" : "were"} marked absent`
    );
    if (result.date) {
      console.log(`   Date: ${result.date}`);
    }

    if (!result.success) {
      console.error(`\n❌ Error: ${result.error || result.message}`);
    } else {
      console.log(`\n✅ Test completed successfully!`);
      if (DRY_RUN) {
        console.log(`\n💡 To actually mark employees absent, run:`);
        console.log(`   node test-absent-real.js ${COMPANY_ID} execute`);
      } else {
        // Verify the records were created
        const newAbsentRecords = await prisma.attendance.findMany({
          where: {
            companyId: company.id,
            date: {
              gte: yesterdayMidnight,
              lt: new Date(yesterdayMidnight.getTime() + 24 * 60 * 60 * 1000),
            },
            status: "ABSENT",
          },
          include: {
            employee: {
              select: { name: true, shiftType: true },
            },
          },
          orderBy: { employee: { name: "asc" } },
        });

        console.log(
          `\n✅ Verified: ${newAbsentRecords.length} absent records created:`
        );
        newAbsentRecords.forEach((record) => {
          console.log(
            `   - ${record.employee.name} (${record.employee.shiftType || "MORNING_SHIFT"})`
          );
        });
      }
    }
  } catch (error) {
    console.error("\n💥 Error:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testAbsentAutomation();
