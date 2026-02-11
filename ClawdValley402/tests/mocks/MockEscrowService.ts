import type { IEscrowService, EscrowResult } from "../../src/application/ports/IEscrowService";
import type { Payment } from "../../src/domain/entities/Payment";

export class MockEscrowService implements IEscrowService {
    private readonly address = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"; // Valid checksummed address

    getEscrowAddress(): string {
        return this.address;
    }

    async releaseToVendor(
        payment: Payment,
        vendorAddress: string
    ): Promise<EscrowResult> {
        console.log(`[MockEscrow] Releasing payment ${payment.id} to vendor ${vendorAddress}`);
        return {
            success: true,
            transaction: `0xmock_release_tx_${Date.now()}`,
        };
    }

    async refundToBuyer(payment: Payment): Promise<EscrowResult> {
        console.log(`[MockEscrow] Refunding payment ${payment.id} to buyer ${payment.payer}`);
        return {
            success: true,
            transaction: `0xmock_refund_tx_${Date.now()}`,
        };
    }
}
