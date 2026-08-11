import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/equipment";
import {
  serializeInstallBaseWorkbook,
  type CustomerGroupExport,
} from "@/lib/xlsx";

/** Formats today's server-local date as YYYY-MM-DD for the export filename. */
function todayDateStamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      include: { equipment: true },
      orderBy: { no: "asc" },
    });

    const groups: CustomerGroupExport[] = customers.map((customer) => ({
      customer: {
        no: customer.no,
        name: customer.name,
        bpNumber: customer.bpNumber,
        uniqueIdentifier: customer.uniqueIdentifier,
        address: customer.address,
        region: customer.region,
        territory: customer.territory,
        mainContact: customer.mainContact,
        contactNumber: customer.contactNumber,
        email: customer.email,
        location: customer.location,
        fnbOrYps: customer.fnbOrYps,
        psaStatus: customer.psaStatus,
        psaContract: customer.psaContract,
        psaEndDate: customer.psaEndDate,
        salesRep: customer.salesRep,
        opsTeam: customer.opsTeam,
      },
      equipment: customer.equipment.map((record) => ({
        equipTag: record.equipTag,
        model: record.model,
        compressorType: record.compressorType,
        serialNumber: record.serialNumber,
        brand: record.brand,
        motorMakeModel: record.motorMakeModel,
        motorSerial: record.motorSerial,
        motorKw: record.motorKw,
        yearInstalled: record.yearInstalled,
        yearCommissioned: record.yearCommissioned,
        runningHours: record.runningHours,
        lastServiceDate: record.lastServiceDate,
        comments: record.comments,
        areaClassification: record.areaClassification,
        equipmentSalesPerson: record.equipmentSalesPerson,
        controllerType: record.controllerType,
        oilType: record.oilType,
        oilCharge: record.oilCharge,
        refType: record.refType,
        refCharge: record.refCharge,
        detailedComments: record.detailedComments,
        thirdPartyCompressorModel: record.thirdPartyCompressorModel,
        thirdPartyRunHours: record.thirdPartyRunHours,
        thirdPartyPsaContract: record.thirdPartyPsaContract,
        condenserMakeModel: record.condenserMakeModel,
        ammoniaPumpMakeModel: record.ammoniaPumpMakeModel,
      })),
    }));

    const buffer = await serializeInstallBaseWorkbook(groups);
    const filename = `id-install-base-export-${todayDateStamp()}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export failed:", error);
    return errorResponse(500, "internal_error", "Something went wrong while generating the export.");
  }
}
