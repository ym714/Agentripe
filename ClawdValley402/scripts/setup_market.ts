import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { RegisterVendor } from "../src/application/usecases/RegisterVendor";
import { RegisterProduct } from "../src/application/usecases/RegisterProduct";
import { PrismaVendorRepository } from "../src/infrastructure/prisma/repositories/PrismaVendorRepository";
import { PrismaProductRepository } from "../src/infrastructure/prisma/repositories/PrismaProductRepository";

const prisma = new PrismaClient();
const vendorRepository = new PrismaVendorRepository(prisma);
const productRepository = new PrismaProductRepository(prisma, vendorRepository);

const registerVendor = new RegisterVendor(vendorRepository);
const registerProduct = new RegisterProduct(productRepository, vendorRepository);

async function setup() {
  try {
    // Cleanup ALL existing vendors (for demo purposes)
    const existingVendors = await prisma.vendor.findMany({});

    for (const vendor of existingVendors) {
      console.log(`Cleaning up existing vendor: ${vendor.id} (${vendor.name})`);
      await prisma.task.deleteMany({ where: { vendorId: vendor.id } });
      await prisma.payment.deleteMany({ where: { vendorId: vendor.id } });
      await prisma.apiKey.deleteMany({ where: { vendorId: vendor.id } });
      await prisma.product.deleteMany({ where: { vendorId: vendor.id } });
      await prisma.vendor.delete({ where: { id: vendor.id } });
    }

    // Register new vendor
    const vendorResult = await registerVendor.execute({
      name: "Prediction Market Analyst",
      evmAddress: "0xBD39339D4B8F79B03557fEbBc1408ec32C43C3Cb",
    });

    console.log("✓ Vendor registered:");
    console.log(`  ID: ${vendorResult.vendor.id}`);
    console.log(`  Name: ${vendorResult.vendor.name}`);
    console.log(`  API Key: ${vendorResult.vendor.apiKey}`);

    const vendorId = vendorResult.vendor.id;

    // Register product
    const productResult = await registerProduct.execute({
      vendorId,
      path: "market-analysis",
      price: "$0.50",
      network: "eip155:84532",
      description: "AI-powered prediction market analysis and forecasting",
      mimeType: "application/json",
      data: JSON.stringify({
        service: "prediction-market-analysis",
        version: "1.0.0",
      }),
      type: "async",
    });

    console.log("\n✓ Product registered:");
    console.log(`  ID: ${productResult.product.id}`);
    console.log(`  Path: ${productResult.product.path}`);
    console.log(`  Price: ${productResult.product.price}`);

    console.log("\n✓ Setup complete!");
    console.log(`\nEndpoint URL: http://localhost:3001/${vendorId}/market-analysis`);
    console.log(`Vendor API Key: ${vendorResult.vendor.apiKey}`);
  } catch (error) {
    console.error("Setup failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setup();
