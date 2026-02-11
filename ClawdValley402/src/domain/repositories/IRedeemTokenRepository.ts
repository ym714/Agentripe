import type { RedeemToken } from "../entities/RedeemToken.js";

export interface IRedeemTokenRepository {
  save(token: RedeemToken): Promise<RedeemToken>;
  findByToken(token: string): Promise<RedeemToken | null>;
}
