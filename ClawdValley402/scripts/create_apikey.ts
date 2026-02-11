import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { CreateAPIKey } from "../src/application/usecases/CreateAPIKey";
import { PrismaVendorRepository } from "../src/infrastructure/prisma/repositories/PrismaVendorRepository";
import { PrismaAPIKeyRepository } from "../src/infrastructure/prisma/repositories/PrismaAPIKeyRepository";

const prisma = new PrismaClient();
const vendorRepository = new PrismaVendorRepository(prisma);
const apiKeyRepository = new PrismaAPIKeyRepository(prisma);

const createAPIKey = new CreateAPIKey(apiKeyRepository);

async function setup() {
  try {
    const vendor = await prisma.vendor.findFirst({
      where: { name: "Prediction Market Analyst" },
    });

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    const result = await createAPIKey.execute({
      vendorId: vendor.id,
      name: "Demo API Key",
      walletAddress: "0xBD39339D4B8F79B03557fEbBc1408ec32C43C3Cb",
    });

    console.log("✓ API Key created:");
    console.log(`  Key: ${result.apiKey.key}`);
    console.log(`  Vendor ID: ${result.apiKey.vendorId}`);
  } catch (error) {
    console.error("Setup failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setup();
