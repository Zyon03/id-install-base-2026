import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { toCustomerItem, toCustomerSummary } from "@/lib/customer";
import { errorResponse } from "@/lib/equipment";

const searchQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: NextRequest) {
  const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = searchQuerySchema.safeParse(rawParams);

  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid query parameters.", z.flattenError(parsed.error));
  }

  const { search, limit } = parsed.data;

  try {
    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { address: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit,
    });

    return NextResponse.json({
      data: { customers: customers.map(toCustomerSummary) },
    });
  } catch (error) {
    console.error("GET /api/customers failed:", error);
    return errorResponse(500, "internal_error", "Something went wrong while searching customers.");
  }
}

const nullableString = z.string().nullable().optional();
const nullableDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid date-time value." })
  .nullable()
  .optional();
const requiredString = z.string().trim().min(1, "This field is required");

// Mirrors contracts/customers/create_customer.yaml's CreateCustomerRequest —
// name/address/region/main_contact required (SPEC.md's Required Fields),
// unknown keys rejected via .strict().
const createCustomerSchema = z
  .object({
    name: requiredString,
    bp_number: nullableString,
    unique_identifier: nullableString,
    address: requiredString,
    region: requiredString,
    territory: nullableString,
    main_contact: requiredString,
    contact_number: nullableString,
    email: nullableString,
    location: nullableString,
    fnb_or_yps: nullableString,
    psa_status: nullableString,
    psa_contract: nullableString,
    psa_end_date: nullableDateTime,
    sales_rep: nullableString,
    ops_team: nullableString,
  })
  .strict();

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse(400, "validation_error", "Request body must be valid JSON.");
  }

  const parsed = createCustomerSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid request body.", z.flattenError(parsed.error));
  }

  const body = parsed.data;

  try {
    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        ...(body.bp_number !== undefined && { bpNumber: body.bp_number }),
        ...(body.unique_identifier !== undefined && { uniqueIdentifier: body.unique_identifier }),
        address: body.address,
        region: body.region,
        ...(body.territory !== undefined && { territory: body.territory }),
        mainContact: body.main_contact,
        ...(body.contact_number !== undefined && { contactNumber: body.contact_number }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.fnb_or_yps !== undefined && { fnbOrYps: body.fnb_or_yps }),
        ...(body.psa_status !== undefined && { psaStatus: body.psa_status }),
        ...(body.psa_contract !== undefined && { psaContract: body.psa_contract }),
        ...(body.psa_end_date !== undefined && {
          psaEndDate: body.psa_end_date === null ? null : new Date(body.psa_end_date),
        }),
        ...(body.sales_rep !== undefined && { salesRep: body.sales_rep }),
        ...(body.ops_team !== undefined && { opsTeam: body.ops_team }),
      },
    });

    return NextResponse.json({ data: toCustomerItem(customer) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers failed:", error);
    return errorResponse(500, "internal_error", "Something went wrong while creating the customer.");
  }
}
