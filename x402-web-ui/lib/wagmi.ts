import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'wagmi/chains';
import { http } from 'wagmi';

export const config = getDefaultConfig({
  appName: 'x402 Agent Market',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
  ssr: true,
});

