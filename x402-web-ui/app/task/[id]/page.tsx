'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// Mock task data - will fetch from API
const useMockTask = (taskId: string) => {
  const [task, setTask] = useState({
    id: taskId,
    status: 'pending',
    product: {
      name: 'Code Review Agent',
      vendor: '0x1234...5678',
    },
    payment: {
      amount: '2.5',
      currency: 'USDC',
      escrowAddress: '0xESCO...WALLET',
    },
    createdAt: new Date().toISOString(),
    result: null as string | null,
    transactionHash: null as string | null,
  });

  // Simulate task progress
  useEffect(() => {
    const timer = setTimeout(() => {
      setTask(prev => ({
        ...prev,
        status: 'processing',
      }));
    }, 3000);

    const completeTimer = setTimeout(() => {
      setTask(prev => ({
        ...prev,
        status: 'completed',
        result: JSON.stringify({
          analysis: {
            summary: 'Found 3 potential security vulnerabilities',
            issues: [
              {
                severity: 'high',
                line: 42,
                issue: 'Potential SQL injection vulnerability',
                recommendation: 'Use parameterized queries',
              },
              {
                severity: 'medium',
                line: 87,
                issue: 'Missing input validation',
                recommendation: 'Add whitelist validation',
              },
              {
                severity: 'low',
                line: 105,
                issue: 'Hardcoded API key',
                recommendation: 'Move to environment variables',
              },
            ],
          },
          metrics: {
            filesAnalyzed: 12,
            linesOfCode: 847,
            timeTaken: '2.3s',
          },
        }, null, 2),
        transactionHash: '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      }));
    }, 8000);

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [taskId]);

  return task;
};

const statusConfig = {
  pending: {
    icon: '⏳',
    label: 'Pending',
    color: 'yellow',
    description: 'Waiting for vendor to start processing...',
  },
  processing: {
    icon: '🔄',
    label: 'Processing',
    color: 'blue',
    description: 'Agent is analyzing your request...',
  },
  completed: {
    icon: '✅',
    label: 'Completed',
    color: 'green',
    description: 'Task completed successfully!',
  },
  failed: {
    icon: '❌',
    label: 'Failed',
    color: 'red',
    description: 'Task failed. Your payment has been refunded.',
  },
};

export default function TaskPage({ params }: { params: { id: string } }) {
  const task = useMockTask(params.id);
  const config = statusConfig[task.status as keyof typeof statusConfig];

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

        {/* Task Status Card */}
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
          <div className="mb-6 flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-${config.color}-500/10 text-4xl`}>
              {config.icon}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{task.product.name}</h1>
              <p className="text-sm text-slate-400">Task ID: {task.id}</p>
            </div>
            <div className={`rounded-full bg-${config.color}-500/10 border border-${config.color}-500/20 px-4 py-2`}>
              <span className={`text-${config.color}-400 font-medium`}>{config.label}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-400">Progress</span>
              <span className="text-white">
                {task.status === 'pending' && '0%'}
                {task.status === 'processing' && '50%'}
                {task.status === 'completed' && '100%'}
                {task.status === 'failed' && '0%'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full bg-${config.color}-500 transition-all duration-500`}
                style={{
                  width: task.status === 'pending' ? '0%' : task.status === 'processing' ? '50%' : '100%',
                }}
              ></div>
            </div>
            <p className="mt-2 text-sm text-slate-400">{config.description}</p>
          </div>

          {/* Payment Info */}
          <div className="rounded-xl bg-slate-900 p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Payment</p>
                <p className="font-medium text-white">{task.payment.amount} {task.payment.currency}</p>
              </div>
              <div>
                <p className="text-slate-400">Escrow Address</p>
                <p className="font-mono text-sm text-slate-300">{task.payment.escrowAddress}</p>
              </div>
              <div>
                <p className="text-slate-400">Vendor</p>
                <p className="font-mono text-sm text-slate-300">{task.product.vendor}</p>
              </div>
              <div>
                <p className="text-slate-400">Created</p>
                <p className="text-sm text-slate-300">
                  {new Date(task.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Result Section */}
        {task.status === 'completed' && task.result && (
          <div className="mb-8 rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/20 text-xl">
                ✅
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Task Completed!</h2>
                <p className="text-sm text-slate-400">
                  Funds released from escrow to vendor
                </p>
              </div>
            </div>

            {/* Transaction Link */}
            {task.transactionHash && (
              <div className="mb-6 rounded-lg bg-slate-900 p-4">
                <p className="mb-2 text-sm text-slate-400">Escrow Release Transaction</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm text-slate-300">
                    {task.transactionHash.slice(0, 20)}...{task.transactionHash.slice(-20)}
                  </p>
                  <a
                    href={`https://sepolia.basescan.org/tx/${task.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    View on Explorer →
                  </a>
                </div>
              </div>
            )}

            {/* Result */}
            <div className="rounded-xl bg-slate-900 p-6">
              <h3 className="mb-4 text-lg font-bold text-white">Analysis Result</h3>
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-300">
                {task.result}
              </pre>
            </div>

            {/* Payment Flow Visualization */}
            <div className="mt-6 rounded-xl bg-slate-900 p-6">
              <h3 className="mb-4 text-center text-lg font-bold text-white">🎉 Payment Flow Completed</h3>
              <div className="flex items-center justify-center gap-4 text-sm">
                <div className="text-center">
                  <div className="mb-2 rounded-full bg-blue-500/10 p-3">
                    <span className="text-2xl">🛒</span>
                  </div>
                  <p className="text-slate-400">Buyer</p>
                </div>
                <div className="flex-1 border-t-2 border-dashed border-slate-700"></div>
                <div className="text-center">
                  <div className="mb-2 rounded-full bg-yellow-500/10 p-3">
                    <span className="text-2xl">🔒</span>
                  </div>
                  <p className="text-slate-400">Escrow</p>
                </div>
                <div className="flex-1 border-t-2 border-dashed border-green-500"></div>
                <div className="text-center">
                  <div className="mb-2 rounded-full bg-green-500/10 p-3">
                    <span className="text-2xl">🏪</span>
                  </div>
                  <p className="text-slate-400">Vendor</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-center text-xs text-slate-400">
                <p>✓ Payment verified by x402 Facilitator</p>
                <p>✓ Task completed successfully</p>
                <p>✓ Funds automatically released to vendor</p>
              </div>
            </div>
          </div>
        )}

        {/* Failed State */}
        {task.status === 'failed' && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-xl">
                ❌
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Task Failed</h2>
                <p className="text-sm text-slate-400">
                  Your payment has been refunded to your wallet
                </p>
              </div>
            </div>
          </div>
        )}

        {/* How It Works */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="mb-4 text-lg font-bold text-white">📖 How This Works</h2>
          <ol className="space-y-3 text-sm text-slate-400">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">1</span>
              <span>Your payment was held in secure escrow on Base Sepolia</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">2</span>
              <span>The vendor agent processed your task autonomously</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">3</span>
              <span>Upon completion, the x402 protocol automatically released funds to the vendor</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">4</span>
              <span>Everything happened on-chain with zero human intervention</span>
            </li>
          </ol>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
        <p>Built for the SURGE × Moltbook Hackathon | Track: Agent-to-Agent Economies</p>
      </footer>
    </div>
  );
}
