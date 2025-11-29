import express from "express";
import { userRoutes } from "../modules/user/user.route";
import { authRoutes } from "../modules/auth/auth.route";
import { ScheduleRoutes } from "../modules/schedule/schedule.route";
import { DoctorScheduleRoutes } from "../modules/doctorSchedule/doctorSchedule.route";
import { SpecialtiesRoutes } from "../modules/specialties/specialties.route";
import { AppointmentRoutes } from "../modules/appointment/appointment.route";
import { adminRoutes } from "../modules/admin/admin.route";
import { DoctorRoutes } from "../modules/doctor/doctor.route";
import { PrescriptionRoutes } from "../modules/prescription/prescription.route";
import { ReviewRoutes } from "../modules/review/review.route";
import { MetaRoutes } from "../modules/meta/meta.route";

const router = express.Router();

const moduleRoutes = [
  {
    path: "/user",
    route: userRoutes,
  },
  {
    path: "/auth",
    route: authRoutes,
  },
  {
    path: "/admin",
    route: adminRoutes,
  },
  {
    path: "/doctor",
    route: DoctorRoutes,
  },
  {
    path: "/schedule",
    route: ScheduleRoutes,
  },
  {
    path: "/doctor-schedule",
    route: DoctorScheduleRoutes,
  },
  {
    path: "/specialties",
    route: SpecialtiesRoutes,
  },
  {
    path: "/appointment",
    route: AppointmentRoutes,
  },
  {
    path: "/prescription",
    route: PrescriptionRoutes,
  },
  {
    path: "/meta",
    route: MetaRoutes,
  },
  {
    path: "/review",
    route: ReviewRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
