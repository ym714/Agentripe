import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaProductRepository } from "../src/infrastructure/prisma/repositories/PrismaProductRepository";
import { PrismaVendorRepository } from "../src/infrastructure/prisma/repositories/PrismaVendorRepository";

const prisma = new PrismaClient();
const vendorRepository = new PrismaVendorRepository(prisma);
const productRepository = new PrismaProductRepository(prisma, vendorRepository);

async function updatePrice() {
  try {
    const vendor = await prisma.vendor.findFirst({
      where: { name: "Prediction Market Analyst" },
    });

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    // Update product price
    await prisma.product.updateMany({
      where: {
        vendorId: vendor.id,
        path: "market-analysis",
      },
      data: {
        price: "$0.10",
      },
    });

    console.log("✓ Product price updated to $0.10 USDC");
  } catch (error) {
    console.error("Update failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updatePrice();
