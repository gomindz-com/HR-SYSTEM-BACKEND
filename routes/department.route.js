import express from "express";
import {
  listDepartments,
  addDepartment,
} from "../controller/department.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", verifyToken, listDepartments);
router.post("/", verifyToken, addDepartment);

export default router;
