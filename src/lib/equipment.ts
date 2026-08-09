import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";

// Every field on EquipmentListItem (contracts/equipment/list_equipment.yaml's
// SortableField enum, and contracts/equipment/update_equipment.yaml's editable
// field set minus the 5 system fields). Shared by the list endpoint (sorting)
// and the update endpoint (routing an edited field to the right table).
export const EQUIPMENT_LIST_FIELDS = [
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

export type EquipmentListField = (typeof EQUIPMENT_LIST_FIELDS)[number];

// Maps a customer-side field (API snake_case) to its Prisma Customer field name.
export const CUSTOMER_FIELD_MAP: Partial<Record<EquipmentListField, keyof Prisma.CustomerUncheckedUpdateInput>> = {
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

// Maps every other field (API snake_case) to its Prisma EquipmentRecord field name.
export const EQUIPMENT_FIELD_MAP: Partial<Record<EquipmentListField, keyof Prisma.EquipmentRecordUncheckedUpdateInput>> = {
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

export type EquipmentWithCustomer = Prisma.EquipmentRecordGetPayload<{
  include: { customer: true };
}>;

/**
 * Maps a Prisma EquipmentRecord (with its Customer relation loaded) onto the
 * snake_case EquipmentListItem shape defined in
 * contracts/equipment/list_equipment.yaml. Response field names intentionally
 * diverge from the camelCase Prisma model, so this transform step is required
 * rather than serializing the Prisma result directly.
 */
export function toEquipmentListItem(record: EquipmentWithCustomer) {
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

/** Shared error envelope shape — see contracts/_shared/error.yaml. */
export function errorResponse(status: number, code: string, message: string, details?: object | null) {
  return NextResponse.json({ error: { code, message, details: details ?? null } }, { status });
}
