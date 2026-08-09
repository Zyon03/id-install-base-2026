import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Every field on EquipmentListItem (contracts/equipment/list_equipment.yaml's
// SortableField enum) — sorting is allowed on any of them.
const SORTABLE_FIELDS = [
  "id",
  "customer_id",
  "customer_no",
  "customer_name",
  "address",
  "region",
  "territory",
  "main_contact",
  "contact_number",
  "email",
  "location",
  "fnb_or_yps",
  "psa_status",
  "psa_contract",
  "psa_end_date",
  "sales_rep",
  "ops_team",
  "equip_tag",
  "model",
  "compressor_type",
  "serial_number",
  "brand",
  "motor_make_model",
  "motor_serial",
  "motor_kw",
  "year_installed",
  "year_commissioned",
  "running_hours",
  "last_service_date",
  "comments",
  "area_classification",
  "equipment_sales_person",
  "controller_type",
  "oil_type",
  "oil_charge",
  "ref_type",
  "ref_charge",
  "detailed_comments",
  "third_party_compressor_model",
  "third_party_run_hours",
  "third_party_psa_contract",
  "condenser_make_model",
  "ammonia_pump_make_model",
  "created_at",
  "updated_at",
] as const;

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
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

// Maps a customer-side sortable field to its Prisma Customer field name.
const CUSTOMER_SORT_FIELDS: Partial<Record<(typeof SORTABLE_FIELDS)[number], keyof Prisma.CustomerOrderByWithRelationInput>> = {
  customer_no: "no",
  customer_name: "name",
  address: "address",
  region: "region",
  territory: "territory",
  main_contact: "mainContact",
  contact_number: "contactNumber",
  email: "email",
  location: "location",
  fnb_or_yps: "fnbOrYps",
  psa_status: "psaStatus",
  psa_contract: "psaContract",
  psa_end_date: "psaEndDate",
  sales_rep: "salesRep",
  ops_team: "opsTeam",
};

// Maps every other sortable field to its Prisma EquipmentRecord field name.
const EQUIPMENT_SORT_FIELDS: Partial<Record<(typeof SORTABLE_FIELDS)[number], keyof Prisma.EquipmentRecordOrderByWithRelationInput>> = {
  id: "id",
  customer_id: "customerId",
  equip_tag: "equipTag",
  model: "model",
  compressor_type: "compressorType",
  serial_number: "serialNumber",
  brand: "brand",
  motor_make_model: "motorMakeModel",
  motor_serial: "motorSerial",
  motor_kw: "motorKw",
  year_installed: "yearInstalled",
  year_commissioned: "yearCommissioned",
  running_hours: "runningHours",
  last_service_date: "lastServiceDate",
  comments: "comments",
  area_classification: "areaClassification",
  equipment_sales_person: "equipmentSalesPerson",
  controller_type: "controllerType",
  oil_type: "oilType",
  oil_charge: "oilCharge",
  ref_type: "refType",
  ref_charge: "refCharge",
  detailed_comments: "detailedComments",
  third_party_compressor_model: "thirdPartyCompressorModel",
  third_party_run_hours: "thirdPartyRunHours",
  third_party_psa_contract: "thirdPartyPsaContract",
  condenser_make_model: "condenserMakeModel",
  ammonia_pump_make_model: "ammoniaPumpMakeModel",
  created_at: "createdAt",
  updated_at: "updatedAt",
};

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
  sortBy: (typeof SORTABLE_FIELDS)[number] | undefined,
  sortOrder: "asc" | "desc"
): Prisma.EquipmentRecordOrderByWithRelationInput[] {
  if (!sortBy) return DEFAULT_ORDER_BY;

  const customerField = CUSTOMER_SORT_FIELDS[sortBy];
  if (customerField) {
    return [{ customer: { [customerField]: sortOrder } }, { id: "asc" }];
  }

  const equipmentField = EQUIPMENT_SORT_FIELDS[sortBy];
  if (equipmentField) {
    return [{ [equipmentField]: sortOrder }, { id: "asc" }];
  }

  return DEFAULT_ORDER_BY;
}

type EquipmentWithCustomer = Prisma.EquipmentRecordGetPayload<{
  include: { customer: true };
}>;

/**
 * Maps a Prisma EquipmentRecord (with its Customer relation loaded) onto the
 * snake_case EquipmentListItem shape defined in
 * contracts/equipment/list_equipment.yaml. Response field names intentionally
 * diverge from the camelCase Prisma model, so this transform step is required
 * rather than serializing the Prisma result directly.
 */
function toEquipmentListItem(record: EquipmentWithCustomer) {
  return {
    id: record.id,
    customer_id: record.customerId,
    customer_no: record.customer.no,
    customer_name: record.customer.name,
    address: record.customer.address,
    region: record.customer.region,
    territory: record.customer.territory,
    main_contact: record.customer.mainContact,
    contact_number: record.customer.contactNumber,
    email: record.customer.email,
    location: record.customer.location,
    fnb_or_yps: record.customer.fnbOrYps,
    psa_status: record.customer.psaStatus,
    psa_contract: record.customer.psaContract,
    psa_end_date: record.customer.psaEndDate?.toISOString() ?? null,
    sales_rep: record.customer.salesRep,
    ops_team: record.customer.opsTeam,
    equip_tag: record.equipTag,
    model: record.model,
    compressor_type: record.compressorType,
    serial_number: record.serialNumber,
    brand: record.brand,
    motor_make_model: record.motorMakeModel,
    motor_serial: record.motorSerial,
    motor_kw: record.motorKw,
    year_installed: record.yearInstalled,
    year_commissioned: record.yearCommissioned,
    running_hours: record.runningHours,
    last_service_date: record.lastServiceDate?.toISOString() ?? null,
    comments: record.comments,
    area_classification: record.areaClassification,
    equipment_sales_person: record.equipmentSalesPerson,
    controller_type: record.controllerType,
    oil_type: record.oilType,
    oil_charge: record.oilCharge,
    ref_type: record.refType,
    ref_charge: record.refCharge,
    detailed_comments: record.detailedComments,
    third_party_compressor_model: record.thirdPartyCompressorModel,
    third_party_run_hours: record.thirdPartyRunHours,
    third_party_psa_contract: record.thirdPartyPsaContract,
    condenser_make_model: record.condenserMakeModel,
    ammonia_pump_make_model: record.ammoniaPumpMakeModel,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

function errorResponse(status: number, code: string, message: string, details?: object | null) {
  return NextResponse.json(
    { error: { code, message, details: details ?? null } },
    { status }
  );
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
