import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";
import {
  addEventToCalendar,
  listCalendars,
  updateCalendar,
  deleteCalendar,
} from "../controller/calendar.controller.js";

const router = express.Router();

router.post("/", verifyToken, requireRole("ADMIN"), addEventToCalendar);
router.get("/", verifyToken, requireRole("ADMIN"), listCalendars);
router.put("/:id", verifyToken, requireRole("ADMIN"), updateCalendar);
router.delete("/:id", verifyToken, requireRole("ADMIN"), deleteCalendar);

export default router;
