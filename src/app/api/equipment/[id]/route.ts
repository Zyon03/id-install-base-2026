import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  CUSTOMER_FIELD_MAP,
  EQUIPMENT_FIELD_MAP,
  errorResponse,
  toEquipmentListItem,
  type EquipmentListField,
} from "@/lib/equipment";

// The 15 fields flagged "Required field..." in
// contracts/equipment/update_equipment.yaml (see SPEC.md's Required Fields
// note). Enforced only when the field is actually present in the request
// body — omitted fields on legacy/sparse rows must never block an unrelated
// edit.
const REQUIRED_FIELDS: readonly EquipmentListField[] = [
  "customer_name",
  "address",
  "region",
  "main_contact",
  "equip_tag",
  "model",
  "compressor_type",
  "serial_number",
  "brand",
  "motor_make_model",
  "motor_serial",
  "motor_kw",
  "controller_type",
  "oil_type",
  "ref_type",
];

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const nullableInt = z.number().int().nullable().optional();
const nullableDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date-time value.",
  })
  .nullable()
  .optional();

// Mirrors contracts/equipment/update_equipment.yaml's UpdateEquipmentRequest
// exactly: every field optional (PATCH semantics), unknown keys rejected via
// .strict() so a typo'd field name is a 400, not a silent no-op.
const updateEquipmentSchema = z
  .object({
    customer_name: z.string().optional(),
    address: nullableString,
    region: nullableString,
    territory: nullableString,
    main_contact: nullableString,
    contact_number: nullableString,
    email: nullableString,
    location: nullableString,
    fnb_or_yps: nullableString,
    psa_status: nullableString,
    psa_contract: nullableString,
    psa_end_date: nullableDateTime,
    sales_rep: nullableString,
    ops_team: nullableString,
    equip_tag: nullableString,
    model: nullableString,
    compressor_type: nullableString,
    serial_number: nullableString,
    brand: nullableString,
    motor_make_model: nullableString,
    motor_serial: nullableString,
    motor_kw: nullableNumber,
    year_installed: nullableInt,
    year_commissioned: nullableInt,
    running_hours: nullableNumber,
    last_service_date: nullableDateTime,
    comments: nullableString,
    area_classification: nullableString,
    equipment_sales_person: nullableString,
    controller_type: nullableString,
    oil_type: nullableString,
    oil_charge: nullableString,
    ref_type: nullableString,
    ref_charge: nullableString,
    detailed_comments: nullableString,
    third_party_compressor_model: nullableString,
    third_party_run_hours: nullableNumber,
    third_party_psa_contract: nullableString,
    condenser_make_model: nullableString,
    ammonia_pump_make_model: nullableString,
  })
  .strict();

type UpdateEquipmentBody = z.infer<typeof updateEquipmentSchema>;

const DATE_FIELDS = new Set<EquipmentListField>(["psa_end_date", "last_service_date"]);

/** psa_end_date/last_service_date arrive as ISO strings but Prisma wants Date objects. */
function toPrismaValue(field: EquipmentListField, value: unknown): unknown {
  if (DATE_FIELDS.has(field) && typeof value === "string") {
    return new Date(value);
  }
  return value;
}

function isBlank(value: unknown): boolean {
  return value === null || (typeof value === "string" && value.trim() === "");
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse(400, "validation_error", "Request body must be valid JSON.");
  }

  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return errorResponse(400, "validation_error", "Request body must be a JSON object.");
  }

  const parsed = updateEquipmentSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid request body.", z.flattenError(parsed.error));
  }

  const body = rawBody as Record<string, unknown>;
  const data = parsed.data as UpdateEquipmentBody;

  // Only fields the client actually sent are validated for blankness — a
  // required field that's already blank on a legacy row must stay editable
  // via edits to its *other* fields (see SPEC.md's Required Fields note).
  for (const field of REQUIRED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field) && isBlank(body[field])) {
      return errorResponse(
        400,
        "validation_error",
        `${field} is a required field and cannot be blank.`,
        { [field]: "This field is required" }
      );
    }
  }

  try {
    const existing = await prisma.equipmentRecord.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse(404, "not_found", `No equipment record exists with id "${id}".`);
    }

    const customerUpdates: Record<string, unknown> = {};
    const equipmentUpdates: Record<string, unknown> = {};

    for (const key of Object.keys(body)) {
      const field = key as EquipmentListField;
      const value = data[field as keyof UpdateEquipmentBody];
      const customerField = CUSTOMER_FIELD_MAP[field];
      const equipmentField = EQUIPMENT_FIELD_MAP[field];

      if (customerField) {
        customerUpdates[customerField] = toPrismaValue(field, value);
      } else if (equipmentField) {
        equipmentUpdates[equipmentField] = toPrismaValue(field, value);
      }
    }

    const hasCustomerUpdates = Object.keys(customerUpdates).length > 0;
    const hasEquipmentUpdates = Object.keys(equipmentUpdates).length > 0;

    if (hasCustomerUpdates && hasEquipmentUpdates) {
      await prisma.$transaction([
        prisma.customer.update({
          where: { id: existing.customerId },
          data: customerUpdates as Prisma.CustomerUncheckedUpdateInput,
        }),
        prisma.equipmentRecord.update({
          where: { id },
          data: equipmentUpdates as Prisma.EquipmentRecordUncheckedUpdateInput,
        }),
      ]);
    } else if (hasCustomerUpdates) {
      await prisma.customer.update({
        where: { id: existing.customerId },
        data: customerUpdates as Prisma.CustomerUncheckedUpdateInput,
      });
    } else if (hasEquipmentUpdates) {
      await prisma.equipmentRecord.update({
        where: { id },
        data: equipmentUpdates as Prisma.EquipmentRecordUncheckedUpdateInput,
      });
    }

    const updated = await prisma.equipmentRecord.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!updated) {
      return errorResponse(404, "not_found", `No equipment record exists with id "${id}".`);
    }

    return NextResponse.json({ data: toEquipmentListItem(updated) });
  } catch (error) {
    console.error(`PATCH /api/equipment/${id} failed:`, error);
    return errorResponse(500, "internal_error", "Something went wrong while updating the equipment record.");
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const existing = await prisma.equipmentRecord.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse(404, "not_found", `No equipment record exists with id "${id}".`);
    }

    await prisma.equipmentRecord.delete({ where: { id } });

    return NextResponse.json({ data: { id } });
  } catch (error) {
    console.error(`DELETE /api/equipment/${id} failed:`, error);
    return errorResponse(500, "internal_error", "Something went wrong while deleting the equipment record.");
  }
}
