-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "no" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "bpNumber" TEXT,
    "uniqueIdentifier" TEXT,
    "address" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "territory" TEXT,
    "mainContact" TEXT NOT NULL,
    "contactNumber" TEXT,
    "email" TEXT,
    "location" TEXT,
    "fnbOrYps" TEXT,
    "psaStatus" TEXT,
    "psaContract" TEXT,
    "psaEndDate" TIMESTAMP(3),
    "salesRep" TEXT,
    "opsTeam" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "equipTag" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "compressorType" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "motorMakeModel" TEXT NOT NULL,
    "motorSerial" TEXT NOT NULL,
    "motorKw" DOUBLE PRECISION NOT NULL,
    "yearInstalled" INTEGER,
    "yearCommissioned" INTEGER,
    "runningHours" DOUBLE PRECISION,
    "lastServiceDate" TIMESTAMP(3),
    "comments" TEXT,
    "areaClassification" TEXT,
    "equipmentSalesPerson" TEXT,
    "controllerType" TEXT NOT NULL,
    "oilType" TEXT NOT NULL,
    "oilCharge" TEXT,
    "refType" TEXT NOT NULL,
    "refCharge" TEXT,
    "detailedComments" TEXT,
    "thirdPartyCompressorModel" TEXT,
    "thirdPartyRunHours" DOUBLE PRECISION,
    "thirdPartyPsaContract" TEXT,
    "condenserMakeModel" TEXT,
    "ammoniaPumpMakeModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_no_key" ON "Customer"("no");

-- AddForeignKey
ALTER TABLE "EquipmentRecord" ADD CONSTRAINT "EquipmentRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
