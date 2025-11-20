import prisma from "../config/prisma.config.js";
import {
  createActivity,
  ACTIVITY_TYPES,
  PRIORITY_LEVELS,
  ICON_TYPES,
} from "../lib/activity-utils.js";

export const addEventToCalendar = async (req, res) => {
  const { companyId, id } = req.user;
  const { type, date, name } = req.body;

  if (!companyId)
    return res.status(400).json({ message: "company id is required" });
  if (!id) return res.status(400).json({ message: "user id is required" });
  if (!name || !type || !date)
    return res
      .status(400)
      .json({ message: "name, type and date are required" });

  const validTypes = ["PUBLIC_HOLIDAY", "SCHOOL_HOLIDAY", "EVENT"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      message: "invalid calendar type",
      validTypes,
    });
  }

  const eventDate = new Date(date);
  eventDate.setHours(0, 0, 0, 0); // Normalize to midnight for date comparison

  if (isNaN(eventDate.getTime())) {
    return res.status(400).json({ message: "invalid date format" });
  }

  try {
    const calendar = await prisma.calendar.create({
      data: {
        companyId,
        createdById: id,
        type,
        date: eventDate,
        name,
        isActive: true,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.CALENDAR,
      title: "Event Added to Calendar",
      description: `${name} event added to calendar`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.LEAVE,
    });

    return res.status(201).json({
      success: true,
      message: "event added to calendar successfully",
      data: calendar,
    });
  } catch (error) {
    console.error("Error adding event to calendar", error);
    return res.status(500).json({
      message: "error adding event to calendar",
      error: error.message,
    });
  }
};

export const listCalendars = async (req, res) => {
  const { companyId } = req.user;

  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  // Database-level pagination (efficient pattern for all list endpoints)
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(req.query.pageSize) || 10)
  );
  const skip = (page - 1) * pageSize;

  const searchTerm = req.query.search?.trim() || "";
  const type = req.query.type;
  const dateFrom = req.query.dateFrom;
  const dateTo = req.query.dateTo;
  const isActive = req.query.isActive;

  try {
    const validTypes = ["PUBLIC_HOLIDAY", "SCHOOL_HOLIDAY", "EVENT"];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        message: "invalid calendar type",
        validTypes,
      });
    }

    // Build dynamic where clause - only include filters that are provided
    const whereClause = {
      companyId,
      ...(searchTerm && {
        name: {
          contains: searchTerm,
          mode: "insensitive",
        },
      }),
      ...(type && {
        type: type,
      }),
      ...(dateFrom &&
        dateTo && {
          date: {
            gte: new Date(dateFrom),
            lte: new Date(dateTo),
          },
        }),
      ...(isActive !== undefined && {
        isActive: isActive === "true" || isActive === true,
      }),
    };

    // Fetch data and count in parallel for better performance
    const [calendars, total] = await Promise.all([
      prisma.calendar.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy: {
          date: "asc",
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.calendar.count({
        where: whereClause,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        calendars,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error listing calendar events", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCalendar = async (req, res) => {
  const { companyId, id } = req.user;
  const calendarId = req.params.id;
  const { type, date, name, isActive } = req.body;

  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  if (!calendarId) {
    return res.status(400).json({ message: "calendar id is required" });
  }

  try {
    const existingCalendar = await prisma.calendar.findFirst({
      where: {
        id: calendarId,
        companyId,
      },
    });

    if (!existingCalendar) {
      return res.status(404).json({ message: "calendar event not found" });
    }

    if (type) {
      const validTypes = ["PUBLIC_HOLIDAY", "SCHOOL_HOLIDAY", "EVENT"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          message: "invalid calendar type",
          validTypes,
        });
      }
    }

    let eventDate = existingCalendar.date;
    if (date) {
      eventDate = new Date(date);
      if (isNaN(eventDate.getTime())) {
        return res.status(400).json({ message: "invalid date format" });
      }
      eventDate.setHours(0, 0, 0, 0); // Normalize to midnight
    }

    // Only update fields that are provided
    const updateData = {};
    if (type) updateData.type = type;
    if (date) updateData.date = eventDate;
    if (name) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive === true;

    const updatedCalendar = await prisma.calendar.update({
      where: {
        id: calendarId,
      },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.CALENDAR,
      title: "Calendar Event Updated",
      description: `${updatedCalendar.name} event was updated`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.LEAVE,
    });

    return res.status(200).json({
      success: true,
      message: "calendar event updated successfully",
      data: updatedCalendar,
    });
  } catch (error) {
    console.error("Error updating calendar event", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCalendar = async (req, res) => {
  const { companyId } = req.user;
  const calendarId = req.params.id;

  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  if (!calendarId) {
    return res.status(400).json({ message: "calendar id is required" });
  }

  try {
    const existingCalendar = await prisma.calendar.findFirst({
      where: {
        id: calendarId,
        companyId,
      },
    });

    if (!existingCalendar) {
      return res.status(404).json({ message: "calendar event not found" });
    }

    await prisma.calendar.delete({
      where: {
        id: calendarId,
      },
    });

    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.CALENDAR,
      title: "Calendar Event Deleted",
      description: `${existingCalendar.name} event was deleted`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.LEAVE,
    });

    return res.status(200).json({
      success: true,
      message: "calendar event deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting calendar event", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
