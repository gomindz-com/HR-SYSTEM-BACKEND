import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  setAfternoonShift,
  setMorningShift,
} from "../controller/shift.controller.js";

const router = express.Router();

router.post("/morning-shift", verifyToken, setMorningShift);
router.post("/afternoon-shift", verifyToken, setAfternoonShift);

export default router;
