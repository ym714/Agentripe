'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { useState } from 'react';

// Mock vendor data
const mockVendor = {
  id: 'vendor_123',
  name: 'Code Review Agent',
  totalRevenue: '1250.00',
  currency: 'USDC',
  products: 3,
  pendingTasks: 2,
};

// Mock tasks
const useMockTasks = () => {
  const [tasks, setTasks] = useState([
    {
      id: '42',
      productId: '1',
      buyerAddress: '0x9876567890123456789012345678901234567890',
      buyerShort: '0x9876...4321',
      status: 'processing',
      payment: '5.0',
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      requestPayload: JSON.stringify({
        code: 'function processUserInput(input) {\n  return db.query("SELECT * FROM users WHERE name = \'" + input + "\'");\n}',
      }),
    },
    {
      id: '41',
      productId: '1',
      buyerAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      buyerShort: '0xabcd...efab',
      status: 'pending',
      payment: '2.5',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      requestPayload: JSON.stringify({
        file: 'main.rs',
        lines: '1-100',
      }),
    },
    {
      id: '40',
      productId: '1',
      buyerAddress: '0x5555555555555555555555555555555555555555',
      buyerShort: '0x5555...5555',
      status: 'completed',
      payment: '2.5',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      result: JSON.stringify({
        issues: [
          { severity: 'medium', line: 23, issue: 'Unused variable' },
        ],
      }),
    },
  ]);

  const completeTask = (taskId: string) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId
          ? {
              ...task,
              status: 'completed',
              result: JSON.stringify({
                analysis: {
                  summary: 'Code review completed',
                  issues: [
                    {
                      severity: 'high',
                      line: 1,
                      issue: 'SQL Injection vulnerability detected',
                      recommendation: 'Use parameterized queries',
                    },
                  ],
                },
                metrics: {
                  timeTaken: '1.8s',
                },
              }),
            }
          : task
      )
    );
  };

  const failTask = (taskId: string) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId
          ? { ...task, status: 'failed' }
          : task
      )
    );
  };

  return { tasks, completeTask, failTask };
};

export default function VendorDashboard() {
  const { tasks, completeTask, failTask } = useMockTasks();
  const [selectedTask, setSelectedTask] = useState<typeof tasks[0] | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleComplete = async (taskId: string) => {
    setProcessing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    completeTask(taskId);
    setProcessing(false);
    setSelectedTask(null);
  };

  const handleFail = async (taskId: string) => {
    setProcessing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    failTask(taskId);
    setProcessing(false);
    setSelectedTask(null);
  };

  const statusConfig = {
    pending: {
      icon: '⏳',
      label: 'Pending',
      color: 'yellow',
    },
    processing: {
      icon: '🔄',
      label: 'Processing',
      color: 'blue',
    },
    completed: {
      icon: '✅',
      label: 'Completed',
      color: 'green',
    },
    failed: {
      icon: '❌',
      label: 'Failed',
      color: 'red',
    },
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
                <p className="text-xs text-slate-400">Vendor Dashboard</p>
              </div>
            </Link>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="mb-8 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <span className="text-slate-400">Total Revenue</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {mockVendor.totalRevenue} {mockVendor.currency}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl">📦</span>
              <span className="text-slate-400">Active Products</span>
            </div>
            <p className="text-3xl font-bold text-white">{mockVendor.products}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl">⏳</span>
              <span className="text-slate-400">Pending Tasks</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {tasks.filter(t => t.status === 'pending' || t.status === 'processing').length}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Tasks List */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50">
              <div className="border-b border-slate-800 p-6">
                <h2 className="text-xl font-bold text-white">Tasks</h2>
                <p className="text-sm text-slate-400">Manage incoming task requests</p>
              </div>
              <div className="divide-y divide-slate-800">
                {tasks.map((task) => {
                  const config = statusConfig[task.status as keyof typeof statusConfig];
                  return (
                    <div
                      key={task.id}
                      className="cursor-pointer p-6 transition-colors hover:bg-slate-900"
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-3">
                            <span className="text-2xl">{config.icon}</span>
                            <div>
                              <p className="font-medium text-white">Task #{task.id}</p>
                              <p className="text-sm text-slate-400">
                                From {task.buyerShort}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className={`rounded-full bg-${config.color}-500/10 px-2 py-1 text-${config.color}-400`}>
                              {config.label}
                            </span>
                            <span className="text-slate-400">
                              {task.payment} USDC
                            </span>
                            <span className="text-slate-500">
                              {new Date(task.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span className="text-slate-400">→</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Task Detail */}
          <div className="lg:col-span-1">
            {selectedTask ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50">
                <div className="border-b border-slate-800 p-6">
                  <h2 className="text-xl font-bold text-white">Task #{selectedTask.id}</h2>
                  <p className="text-sm text-slate-400">Task details and actions</p>
                </div>
                <div className="p-6 space-y-4">
                  {/* Status */}
                  <div>
                    <p className="mb-2 text-sm text-slate-400">Status</p>
                    <div className={`rounded-full bg-${statusConfig[selectedTask.status as keyof typeof statusConfig].color}-500/10 border border-${statusConfig[selectedTask.status as keyof typeof statusConfig].color}-500/20 px-3 py-2 inline-flex items-center gap-2`}>
                      <span>{statusConfig[selectedTask.status as keyof typeof statusConfig].icon}</span>
                      <span className={`text-${statusConfig[selectedTask.status as keyof typeof statusConfig].color}-400 font-medium`}>
                        {statusConfig[selectedTask.status as keyof typeof statusConfig].label}
                      </span>
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="rounded-xl bg-slate-900 p-4">
                    <p className="mb-2 text-sm text-slate-400">Payment</p>
                    <p className="text-2xl font-bold text-white">
                      {selectedTask.payment} USDC
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Held in escrow
                    </p>
                  </div>

                  {/* Buyer */}
                  <div>
                    <p className="mb-2 text-sm text-slate-400">Buyer</p>
                    <p className="font-mono text-sm text-slate-300">
                      {selectedTask.buyerShort}
                    </p>
                  </div>

                  {/* Request Payload */}
                  <div>
                    <p className="mb-2 text-sm text-slate-400">Request</p>
                    <pre className="max-h-32 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
                      {selectedTask.requestPayload}
                    </pre>
                  </div>

                  {/* Actions */}
                  {(selectedTask.status === 'pending' || selectedTask.status === 'processing') && (
                    <div className="space-y-2">
                      <button
                        onClick={() => handleComplete(selectedTask.id)}
                        disabled={processing}
                        className="w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processing ? 'Processing...' : '✅ Complete & Release Payment'}
                      </button>
                      <button
                        onClick={() => handleFail(selectedTask.id)}
                        disabled={processing}
                        className="w-full rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ❌ Fail & Refund
                      </button>
                    </div>
                  )}

                  {/* Result (if completed) */}
                  {selectedTask.status === 'completed' && selectedTask.result && (
                    <div>
                      <p className="mb-2 text-sm text-slate-400">Result</p>
                      <pre className="max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
                        {selectedTask.result}
                      </pre>
                      <div className="mt-3 rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                        <p className="text-xs text-green-400 text-center">
                          ✓ Payment released to your wallet
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Close button */}
                  <button
                    onClick={() => setSelectedTask(null)}
                    className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center">
                <div className="mb-4 text-4xl">📋</div>
                <h3 className="mb-2 text-lg font-bold text-white">No Task Selected</h3>
                <p className="text-sm text-slate-400">
                  Select a task from the list to view details and take action
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Auto-Release Notice */}
        <div className="mt-8 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-xl">
              🤖
            </div>
            <div>
              <h3 className="mb-2 text-lg font-bold text-white">Fully Autonomous</h3>
              <p className="text-sm text-slate-400">
                When you complete a task, the payment is <strong>automatically released</strong> from escrow to your wallet.
                No manual approval needed. This is the power of the x402 protocol on-chain.
              </p>
            </div>
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
