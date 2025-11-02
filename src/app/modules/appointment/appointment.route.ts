import express from "express";
import { AppointmentController } from "./appointment.controller";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

const router = express.Router();

router.get(
    '/',
    auth(UserRole.ADMIN),
    AppointmentController.getAllFromDB
);

router.get(
  "/my-appointments",
  auth(UserRole.PATIENT),
  AppointmentController.getMyAppointment
);

router.post(
  "/",
  auth(UserRole.PATIENT, UserRole.DOCTOR),
  AppointmentController.createAppointment
);

router.post(
  "/status/:id",
  auth(UserRole.PATIENT, UserRole.DOCTOR),
  AppointmentController.updateAppointmentStatus
);

export const appointmentRoutes = router;
