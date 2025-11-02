import httpStatus from "http-status";
import { UserStatus, type Doctor, type Prisma } from "@prisma/client";
import { paginationHelper, type IOptions } from "../../helper/paginationHelper";
import { doctorSearchableFields } from "./doctor.constant";
import { prisma } from "../../shared/prisma";
import type { IDoctorUpdateInput } from "./doctor.interface";
import ApiError from "../../errors/ApiError";
import { extractJsonFromMessage } from "../../helper/extractJsonFromMessage";
import { openai } from "../../helper/open-router";

const getAllFromDB = async (filters: any, options: IOptions) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { searchTerm, specialties, ...filterData } = filters;

  const andConditions: Prisma.DoctorWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: doctorSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive",
        },
      })),
    });
  }

  if (specialties && specialties.length > 0) {
    andConditions.push({
      doctorSpecialties: {
        some: {
          specialties: {
            title: {
              contains: specialties,
              mode: "insensitive",
            },
          },
        },
      },
    });
  }

  if (Object.keys(filterData).length > 0) {
    const filterConditions = Object.keys(filterData).map((key) => ({
      [key]: {
        equals: (filterData as any)[key],
      },
    }));

    andConditions.push(...filterConditions);
  }

  const whereConditions: Prisma.DoctorWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.doctor.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      doctorSpecialties: {
        include: { specialties: true },
      },
      // reviews: true,
      reviews: {
        select: {
          rating: true,
        },
      },
    },
  });

  const total = await prisma.doctor.count({
    where: whereConditions,
  });

  return {
    meta: {
      total,
      page,
      limit,
    },
    data: result,
  };
};

const updateIntoDB = async (
  id: string,
  payload: Partial<IDoctorUpdateInput>
) => {
  const doctorInfo = await prisma.doctor.findUniqueOrThrow({
    where: {
      id,
    },
  });

  const { specialties, ...doctorData } = payload;

  return await prisma.$transaction(async (tnx) => {
    if (specialties && specialties.length > 0) {
      const deleteSpecialtyIds = specialties.filter(
        (specialty) => specialty.isDeleted
      );

      for (const specialty of deleteSpecialtyIds) {
        await tnx.doctorSpecialties.deleteMany({
          where: {
            doctorId: id,
            specialtiesId: specialty.specialtyId,
          },
        });
      }

      const createSpecialtyIds = specialties.filter(
        (specialty) => !specialty.isDeleted
      );

      for (const specialty of createSpecialtyIds) {
        await tnx.doctorSpecialties.create({
          data: {
            doctorId: id,
            specialtiesId: specialty.specialtyId,
          },
        });
      }
    }

    const updatedData = await tnx.doctor.update({
      where: {
        id: doctorInfo.id,
      },
      data: doctorData,
      include: {
        doctorSpecialties: {
          include: {
            specialties: true,
          },
        },
      },

      // doctor - doctorSpecialties - specialties
    });

    return updatedData;
  });
};

const getByIdFromDB = async (id: string): Promise<Doctor | null> => {
  const result = await prisma.doctor.findUnique({
    where: {
      id,
      isDeleted: false,
    },
    include: {
      doctorSpecialties: {
        include: {
          specialties: true,
        },
      },
      doctorSchedules: {
        include: {
          schedule: true,
        },
      },
      reviews: true,
    },
  });
  return result;
};

const deleteFromDB = async (id: string): Promise<Doctor> => {
  return await prisma.$transaction(async (transactionClient) => {
    const deleteDoctor = await transactionClient.doctor.delete({
      where: {
        id,
      },
    });

    await transactionClient.user.delete({
      where: {
        email: deleteDoctor.email,
      },
    });

    return deleteDoctor;
  });
};

const softDelete = async (id: string): Promise<Doctor> => {
  return await prisma.$transaction(async (transactionClient) => {
    const deleteDoctor = await transactionClient.doctor.update({
      where: { id },
      data: {
        isDeleted: true,
      },
    });

    await transactionClient.user.update({
      where: {
        email: deleteDoctor.email,
      },
      data: {
        status: UserStatus.DELETED,
      },
    });

    return deleteDoctor;
  });
};

export const getAISuggestions = async (payload: { symptoms: string }) => {
  try {
    // 🔹 Validate input
    if (!payload?.symptoms) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Symptoms is required!");
    }

    // 🔹 Get all available doctors with specialties
    const doctors = await prisma.doctor.findMany({
      where: {
        isDeleted: false,
      },
      include: {
        doctorSpecialties: {
          include: {
            specialties: true,
          },
        },
      },
    });

    // 🔹 Prepare AI prompt
    const prompt = `
You are a medical assistant AI.
Based on the patient's symptoms, suggest the top 3 most suitable doctors.

Symptoms: ${payload.symptoms}

Here is the doctor list (JSON):
${JSON.stringify(doctors, null, 2)}

⚠️ Return ONLY a valid JSON array — no explanations or extra text.
Each doctor object should include: id, name, specialties, and experience.
`;

    // 🔹 Call AI model
    const completion = await openai.chat.completions.create({
      model: "z-ai/glm-4.5-air:free",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI medical assistant that provides JSON-only doctor suggestions.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const aiMessage = completion?.choices?.[0]?.message;
    if (!aiMessage) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "AI response missing!"
      );
    }

    // 🔹 Extract JSON safely
    const result = extractJsonFromMessage(aiMessage);

    // 🔹 If no valid JSON found, fallback response
    if (!Array.isArray(result) || result.length === 0) {
      return {
        success: true,
        message:
          "AI could not generate a valid structured response. Please try again later.",
        data: [],
      };
    }

    // ✅ Success
    return {
      success: true,
      message: "AI suggestions retrieved successfully.",
      data: result,
    };
  } catch (error: any) {
    console.error("💥 getAISuggestions Error:", error.message);

    return {
      success: false,
      message:
        error?.message ||
        "Failed to get AI suggestions due to unexpected issue.",
      error: error || {},
    };
  }
};

export const DoctorService = {
  getAllFromDB,
  updateIntoDB,
  getByIdFromDB,
  deleteFromDB,
  softDelete,

  getAISuggestions,
};
