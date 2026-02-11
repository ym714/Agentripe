'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import Link from 'next/link';
import { useState } from 'react';

// USDC Contract on Base Sepolia
const USDC_CONTRACT = {
  address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const,
  abi: [
    {
      name: 'transferWithAuthorization',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'signature', type: 'bytes' },
      ],
      outputs: [],
    },
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ],
} as const;

// Mock product data - will fetch from API
const mockProduct = {
  id: '1',
  name: 'Code Review Agent',
  description: 'AI-powered security code review. Detects vulnerabilities, suggests fixes, ensures best practices.\n\nThis agent analyzes your codebase for:\n• Security vulnerabilities (SQL injection, XSS, etc.)\n• Performance issues\n• Code quality concerns\n• Best practice violations',
  price: '2.5',
  priceWei: '2500000',
  currency: 'USDC',
  vendor: '0x1234567890123456789012345678901234567890',
  vendorShort: '0x1234...5678',
  reputation: 4.8,
  totalTasks: 156,
  type: 'async',
  network: 'base',
  escrowAddress: '0xESCROWADDRESS',
};

// Mock recent transactions
const mockTransactions = [
  { hash: '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890', time: '2 mins ago', amount: '2.5' },
  { hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd', time: '15 mins ago', amount: '2.5' },
  { hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321', time: '1 hour ago', amount: '2.5' },
];

export default function ProductPage({ params }: { params: { id: string } }) {
  const { address, isConnected } = useAccount();
  const [purchasing, setPurchasing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: balance } = useReadContract({
    ...USDC_CONTRACT,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const handlePurchase = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (balance && Number(balance) < Number(mockProduct.priceWei)) {
      setError('Insufficient USDC balance');
      return;
    }

    setPurchasing(true);
    setError(null);

    try {
      // In a real implementation, this would:
      // 1. Call the x402-sales-server API
      // 2. Get payment required response
      // 3. Create signature for transferWithAuthorization
      // 4. Submit to facilitator
      // 5. Get task ID back

      // For demo, simulate the flow
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate a mock task ID
      const mockTaskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setTaskId(mockTaskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const formatUSDC = (wei: string) => {
    return (Number(wei) / 1e6).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">x402 Agent Market</h1>
                <p className="text-xs text-slate-400">Powered by USDC on Base</p>
              </div>
            </Link>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Back button */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm text-slate-400 transition-colors hover:text-white"
        >
          <span className="mr-2">←</span>
          Back to marketplace
        </Link>

        {/* Product Header */}
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-4xl">
                  🧠
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">{mockProduct.name}</h1>
                  <p className="text-sm text-slate-400">by {mockProduct.vendorShort}</p>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 text-sm">
                  <span className="text-yellow-500">⭐</span>
                  <span className="font-medium text-white">{mockProduct.reputation}/5</span>
                  <span className="text-slate-400">({mockProduct.totalTasks} tasks)</span>
                </div>
                <div className="rounded-full bg-blue-500/10 px-3 py-1.5 text-sm text-blue-400">
                  {mockProduct.type.toUpperCase()}
                </div>
                <div className="rounded-full bg-purple-500/10 px-3 py-1.5 text-sm text-purple-400">
                  {mockProduct.network.toUpperCase()}
                </div>
              </div>

              <div className="prose prose-invert max-w-none">
                <p className="text-slate-300 whitespace-pre-line">{mockProduct.description}</p>
              </div>
            </div>

            {/* Price Card */}
            <div className="ml-8 w-64 rounded-xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Price</p>
              <p className="mb-4 text-3xl font-bold text-white">
                {mockProduct.price} {mockProduct.currency}
              </p>

              {taskId ? (
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-green-400">
                    <span className="text-xl">✅</span>
                    <span className="font-medium">Purchase Successful!</span>
                  </div>
                  <p className="mb-3 text-xs text-slate-400">Your task has been created</p>
                  <div className="rounded bg-slate-900 p-2">
                    <p className="font-mono text-xs text-slate-300">Task ID: {taskId}</p>
                  </div>
                  <Link
                    href={`/task/${taskId}`}
                    className="mt-3 block rounded-lg bg-green-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-green-500"
                  >
                    View Task Status
                  </Link>
                </div>
              ) : (
                <>
                  <button
                    onClick={handlePurchase}
                    disabled={purchasing}
                    className="mb-3 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {purchasing ? 'Processing...' : 'Purchase with USDC'}
                  </button>

                  {error && (
                    <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  )}

                  {isConnected && balance && (
                    <p className="text-xs text-slate-400">
                      Your balance: {formatUSDC(balance.toString())} USDC
                    </p>
                  )}

                  <div className="mt-4 space-y-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500/20 text-green-500">✓</span>
                      <span>Escrow secured</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500/20 text-green-500">✓</span>
                      <span>Auto-refund if failed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500/20 text-green-500">✓</span>
                      <span>x402 Protocol</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="mb-4 text-xl font-bold text-white">💳 Payment via x402 Protocol</h2>
          <div className="rounded-xl bg-slate-900 p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Network</p>
                <p className="font-medium text-white">Base Sepolia</p>
              </div>
              <div>
                <p className="text-slate-400">Asset</p>
                <p className="font-medium text-white">USDC</p>
              </div>
              <div>
                <p className="text-slate-400">Escrow</p>
                <p className="font-medium text-green-400">Enabled</p>
              </div>
              <div>
                <p className="text-slate-400">Protocol</p>
                <p className="font-medium text-white">x402 V1</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="mb-4 text-xl font-bold text-white">📜 Recent Transactions</h2>
          <div className="space-y-3">
            {mockTransactions.map((tx) => (
              <div
                key={tx.hash}
                className="flex items-center justify-between rounded-lg bg-slate-900 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                    <span className="text-green-500">✓</span>
                  </div>
                  <div>
                    <p className="font-mono text-sm text-slate-400">
                      {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                    </p>
                    <p className="text-xs text-slate-500">{tx.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">{tx.amount} USDC</p>
                  <a
                    href={`https://sepolia.basescan.org/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    View on Explorer →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
        <p>Built for the SURGE × Moltbook Hackathon | Track: Agent-to-Agent Economies</p>
      </footer>
    </div>
  );
}
