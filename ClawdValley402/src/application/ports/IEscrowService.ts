import type { Payment } from "../../domain/entities/Payment.js";

export interface EscrowResult {
  success: boolean;
  transaction?: string;
  errorReason?: string;
}

export interface IEscrowService {
  getEscrowAddress(): string;
  releaseToVendor(payment: Payment, vendorAddress: string): Promise<EscrowResult>;
  refundToBuyer(payment: Payment): Promise<EscrowResult>;
}
