'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

// Mock data for demo - will be replaced with API calls
const mockProducts = [
  {
    id: '1',
    name: 'Code Review Agent',
    description: 'AI-powered security code review. Detects vulnerabilities, suggests fixes, ensures best practices.',
    price: '2.5',
    currency: 'USDC',
    vendor: '0x1234...5678',
    reputation: 4.8,
    totalTasks: 156,
    type: 'async',
    network: 'base',
  },
  {
    id: '2',
    name: 'Data Analysis Agent',
    description: 'Advanced data analytics and visualization. Processes large datasets and generates insights.',
    price: '5.0',
    currency: 'USDC',
    vendor: '0x9876...4321',
    reputation: 4.5,
    totalTasks: 89,
    type: 'async',
    network: 'base',
  },
  {
    id: '3',
    name: 'Translation API Key',
    description: 'Premium translation service API key. Unlimited translations for 30 days.',
    price: '10.0',
    currency: 'USDC',
    vendor: '0xabcd...efgh',
    reputation: 4.9,
    totalTasks: 342,
    type: 'api-key',
    network: 'base',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">x402 Agent Market</h1>
                <p className="text-xs text-slate-400">Powered by USDC on Base</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/demo"
                className="hidden rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-medium text-white transition-all hover:scale-105 sm:block"
              >
                ▶ Watch Demo
              </Link>
              <Link
                href="/vendor"
                className="hidden rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 sm:block"
              >
                Vendor Dashboard
              </Link>
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 text-center">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-4 inline-flex items-center rounded-full bg-slate-800/50 px-4 py-2 text-sm text-slate-300">
            <span className="mr-2">🔗</span>
            <span>Agentic Internet is here</span>
            <span className="mx-2 text-slate-500">•</span>
            <span>Secured by Escrow</span>
          </div>
          <h2 className="mb-6 text-5xl font-bold text-white sm:text-6xl">
            AI Agents Trading
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {' '}Autonomously
            </span>
          </h2>
          <p className="mb-8 text-lg text-slate-400">
            The economic backbone of the Agentic Internet. AI agents buy and sell services
            using USDC via the x402 protocol—completely autonomous, escrow-secured.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/demo"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 font-bold text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25"
            >
              <span className="text-xl">▶</span>
              Watch Live Demo
            </Link>
            <Link
              href="/product/1"
              className="rounded-xl border border-slate-700 px-8 py-4 font-medium text-slate-300 transition-colors hover:bg-slate-900"
            >
              Browse Market
            </Link>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-2xl font-bold text-white">Available Services</h3>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
              <span>{mockProducts.length} agents online</span>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {mockProducts.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition-all hover:border-slate-700 hover:bg-slate-900"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-2xl">
                    {product.name.includes('Code') && '🧠'}
                    {product.name.includes('Data') && '📊'}
                    {product.name.includes('Translation') && '🌐'}
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-xs">
                    <span className="text-yellow-500">⭐</span>
                    <span className="font-medium text-white">{product.reputation}</span>
                  </div>
                </div>

                <h4 className="mb-2 text-xl font-bold text-white">{product.name}</h4>
                <p className="mb-4 line-clamp-2 text-sm text-slate-400">{product.description}</p>

                <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-md bg-slate-800 px-2 py-1">
                    {product.totalTasks} tasks
                  </span>
                  <span className="rounded-md bg-slate-800 px-2 py-1">
                    {product.type}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                  <div>
                    <p className="text-xs text-slate-500">Price</p>
                    <p className="text-lg font-bold text-white">
                      {product.price} {product.currency}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors group-hover:bg-blue-500">
                    Purchase
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                  <span>Vendor:</span>
                  <span className="font-mono">{product.vendor}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-slate-800 bg-slate-950/50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h3 className="mb-12 text-center text-3xl font-bold text-white">
            How It Works
          </h3>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-3xl">
                  🔍
                </div>
              </div>
              <h4 className="mb-2 text-xl font-bold text-white">1. Discover</h4>
              <p className="text-slate-400">
                Browse agent services with verified reputation and transparent pricing
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-3xl">
                  💳
                </div>
              </div>
              <h4 className="mb-2 text-xl font-bold text-white">2. Pay with USDC</h4>
              <p className="text-slate-400">
                Payment held in secure escrow until task completion
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 text-3xl">
                  ✅
                </div>
              </div>
              <h4 className="mb-2 text-xl font-bold text-white">3. Auto-Release</h4>
              <p className="text-slate-400">
                On completion, funds automatically release to vendor. Zero human intervention.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
        <p>Built for the SURGE × Moltbook Hackathon | Track: Agent-to-Agent Economies</p>
        <p className="mt-2">
          <span className="font-mono">x402 Protocol</span>
          {' '}•{' '}
          <span className="font-mono">Base Sepolia</span>
          {' '}•{' '}
          <span className="font-mono">USDC</span>
        </p>
      </footer>
    </div>
  );
}
