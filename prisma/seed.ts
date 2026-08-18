import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { parseInstallBaseWorkbook } from "../src/lib/xlsx";

const SOURCE_FILE = "ID install base 2026 (higlighted ).xlsx";

async function ensureAppConfig() {
  const existing = await prisma.appConfig.count();
  if (existing > 0) {
    console.log("AppConfig already exists, leaving installsPassword untouched.");
    return;
  }

  await prisma.appConfig.create({
    data: { installsPassword: "changeme" },
  });
  console.log(
    "Created AppConfig with a placeholder password — set the real value via " +
      "`npx prisma studio` before relying on the /installs gate."
  );
}

async function main() {
  await ensureAppConfig();

  const filePath = path.join(process.cwd(), SOURCE_FILE);

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    throw new Error(
      `Could not find "${SOURCE_FILE}" in the project root. This file contains real ` +
        "customer data, is gitignored, and must be placed there locally before seeding."
    );
  }

  const groups = await parseInstallBaseWorkbook(buffer);
  const totalEquipment = groups.reduce((sum, g) => sum + g.equipment.length, 0);
  console.log(`Parsed ${groups.length} customers, ${totalEquipment} equipment records.`);

  console.log("Clearing existing data...");
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "EquipmentRecord", "Customer" RESTART IDENTITY CASCADE'
  );

  console.log("Seeding...");
  for (const group of groups) {
    await prisma.customer.create({
      data: {
        ...group.customer,
        equipment: {
          create: group.equipment,
        },
      },
    });
  }

  const customerCount = await prisma.customer.count();
  const equipmentCount = await prisma.equipmentRecord.count();
  console.log(`Seeded ${customerCount} customers, ${equipmentCount} equipment records.`);

  if (customerCount !== groups.length || equipmentCount !== totalEquipment) {
    throw new Error(
      `Seeded counts don't match parsed counts (customers ${customerCount}/${groups.length}, ` +
        `equipment ${equipmentCount}/${totalEquipment}).`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
