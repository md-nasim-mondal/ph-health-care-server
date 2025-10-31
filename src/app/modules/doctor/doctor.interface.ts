import type { Doctor, Gender } from "@prisma/client";

export type IDoctorUpdateInput = {
  email: string;
  contactNumber: string;
  gender: Gender;
  appointmentFee: number;
  name: string;
  address: string;
  registrationNumber: string;
  experience: number;
  qualification: string;
  currentWorkingPlace: string;
  designation: string;
  isDeleted: boolean;
  specialties: {
    specialtyId: string;
    isDeleted?: boolean;
  }[];
};

export interface IDoctorUpdateInputCheck extends Doctor {
  specialties: {
    specialtyId: string;
    isDeleted?: boolean;
  }[];
}
