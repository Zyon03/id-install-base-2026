import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  CUSTOMER_FIELD_MAP,
  EQUIPMENT_FIELD_MAP,
  EQUIPMENT_LIST_FIELDS,
  errorResponse,
  toEquipmentListItem,
  type EquipmentListField,
} from "@/lib/equipment";

// Query params come in as strings off the URL — z.coerce handles page/page_size
// numeric coercion, everything else is matched/filtered as a plain string.
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().optional(),
  region: z.string().optional(),
  territory: z.string().optional(),
  brand: z.string().optional(),
  compressor_type: z.string().optional(),
  fnb_or_yps: z.string().optional(),
  psa_status: z.string().optional(),
  controller_type: z.string().optional(),
  oil_type: z.string().optional(),
  ref_type: z.string().optional(),
  sort_by: z.enum(EQUIPMENT_LIST_FIELDS).optional(),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

const DEFAULT_ORDER_BY: Prisma.EquipmentRecordOrderByWithRelationInput[] = [
  { customer: { name: "asc" } },
  { id: "asc" },
];

/**
 * Always appends `id` as a secondary sort key — without a stable tiebreaker,
 * rows sharing an equal sort value could shuffle between pages across
 * requests, causing duplicate/missing rows as the user pages through.
 */
function buildOrderBy(
  sortBy: EquipmentListField | undefined,
  sortOrder: "asc" | "desc"
): Prisma.EquipmentRecordOrderByWithRelationInput[] {
  if (!sortBy) return DEFAULT_ORDER_BY;

  const customerField = CUSTOMER_FIELD_MAP[sortBy];
  if (customerField) {
    return [{ customer: { [customerField]: sortOrder } }, { id: "asc" }];
  }

  const equipmentField = EQUIPMENT_FIELD_MAP[sortBy];
  if (equipmentField) {
    return [{ [equipmentField]: sortOrder }, { id: "asc" }];
  }

  return DEFAULT_ORDER_BY;
}

export async function GET(request: NextRequest) {
  const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(rawParams);

  if (!parsed.success) {
    return errorResponse(
      400,
      "validation_error",
      "Invalid query parameters.",
      z.flattenError(parsed.error)
    );
  }

  const {
    page,
    page_size,
    search,
    region,
    territory,
    brand,
    compressor_type,
    fnb_or_yps,
    psa_status,
    controller_type,
    oil_type,
    ref_type,
    sort_by,
    sort_order,
  } = parsed.data;

  try {
    const customerFilters: Prisma.CustomerWhereInput = {};
    if (region) customerFilters.region = region;
    if (territory) customerFilters.territory = territory;
    if (fnb_or_yps) customerFilters.fnbOrYps = fnb_or_yps;
    if (psa_status) customerFilters.psaStatus = psa_status;

    const where: Prisma.EquipmentRecordWhereInput = {};
    if (Object.keys(customerFilters).length > 0) {
      where.customer = customerFilters;
    }
    if (brand) where.brand = brand;
    if (compressor_type) where.compressorType = compressor_type;
    if (controller_type) where.controllerType = controller_type;
    if (oil_type) where.oilType = oil_type;
    if (ref_type) where.refType = ref_type;

    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { address: { contains: search, mode: "insensitive" } } },
        { equipTag: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * page_size;

    const [records, totalItems] = await Promise.all([
      prisma.equipmentRecord.findMany({
        where,
        include: { customer: true },
        orderBy: buildOrderBy(sort_by, sort_order),
        skip,
        take: page_size,
      }),
      prisma.equipmentRecord.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        equipment: records.map(toEquipmentListItem),
        pagination: {
          page,
          page_size,
          total_items: totalItems,
          total_pages: Math.ceil(totalItems / page_size),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/equipment failed:", error);
    return errorResponse(500, "internal_error", "Something went wrong while fetching equipment records.");
  }
}

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const nullableInt = z.number().int().nullable().optional();
const nullableDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid date-time value." })
  .nullable()
  .optional();
const requiredString = z.string().trim().min(1, "This field is required");

// Mirrors contracts/equipment/create_equipment.yaml's CreateEquipmentRequest —
// customer_id + the 11 equipment-side required fields from SPEC.md are
// required; every other equipment field is optional. No customer fields are
// accepted here — see the contract's note on why customer creation is a
// separate POST /api/customers call. Unknown keys rejected via .strict().
const createEquipmentSchema = z
  .object({
    customer_id: requiredString,
    equip_tag: requiredString,
    model: requiredString,
    compressor_type: requiredString,
    serial_number: requiredString,
    brand: requiredString,
    motor_make_model: requiredString,
    motor_serial: requiredString,
    motor_kw: z.number(),
    year_installed: nullableInt,
    year_commissioned: nullableInt,
    running_hours: nullableNumber,
    last_service_date: nullableDateTime,
    comments: nullableString,
    area_classification: nullableString,
    equipment_sales_person: nullableString,
    controller_type: requiredString,
    oil_type: requiredString,
    oil_charge: nullableString,
    ref_type: requiredString,
    ref_charge: nullableString,
    detailed_comments: nullableString,
    third_party_compressor_model: nullableString,
    third_party_run_hours: nullableNumber,
    third_party_psa_contract: nullableString,
    condenser_make_model: nullableString,
    ammonia_pump_make_model: nullableString,
  })
  .strict();

const DATE_FIELDS = new Set<EquipmentListField>(["last_service_date"]);

function toPrismaValue(field: EquipmentListField, value: unknown): unknown {
  if (DATE_FIELDS.has(field) && typeof value === "string") {
    return new Date(value);
  }
  return value;
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse(400, "validation_error", "Request body must be valid JSON.");
  }

  const parsed = createEquipmentSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid request body.", z.flattenError(parsed.error));
  }

  const { customer_id, ...fields } = parsed.data;

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customer_id } });
    if (!customer) {
      return errorResponse(404, "not_found", `No customer exists with id "${customer_id}".`);
    }

    const equipmentData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      const field = key as EquipmentListField;
      const prismaField = EQUIPMENT_FIELD_MAP[field];
      if (prismaField) {
        equipmentData[prismaField] = toPrismaValue(field, value);
      }
    }

    const record = await prisma.equipmentRecord.create({
      data: { customerId: customer_id, ...equipmentData } as Prisma.EquipmentRecordUncheckedCreateInput,
      include: { customer: true },
    });

    return NextResponse.json({ data: toEquipmentListItem(record) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/equipment failed:", error);
    return errorResponse(500, "internal_error", "Something went wrong while creating the equipment record.");
  }
}
