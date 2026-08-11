import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/equipment";
import { parseInstallBaseWorkbook } from "@/lib/xlsx";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, "validation_error", "Request body must be valid multipart/form-data.");
  }

  const file = formData.get("file");
  const confirm = formData.get("confirm");

  if (!(file instanceof Blob)) {
    return errorResponse(400, "validation_error", "A file is required.", { file: "This field is required" });
  }
  if (confirm !== "true") {
    return errorResponse(400, "validation_error", "Import must be explicitly confirmed.", {
      confirm: "Must be true to proceed.",
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let groups;
  try {
    groups = await parseInstallBaseWorkbook(buffer);
  } catch (error) {
    console.error("POST /api/import: failed to parse workbook:", error);
    return errorResponse(400, "validation_error", "Uploaded file is not a valid .xlsx workbook, or its columns don't match the expected install base layout.");
  }

  const totalEquipment = groups.reduce((sum, g) => sum + g.equipment.length, 0);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'TRUNCATE TABLE "EquipmentRecord", "Customer" RESTART IDENTITY CASCADE'
      );

      for (const group of groups) {
        await tx.customer.create({
          data: {
            ...group.customer,
            equipment: {
              create: group.equipment,
            },
          },
        });
      }
    });

    return NextResponse.json({
      data: { customers_imported: groups.length, equipment_imported: totalEquipment },
    });
  } catch (error) {
    console.error("POST /api/import failed:", error);
    return errorResponse(500, "internal_error", "Something went wrong while importing the file.");
  }
}
