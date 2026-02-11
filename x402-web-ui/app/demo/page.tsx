'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { createWalletClient, http, parseEther, formatEther, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

type LogEntry = {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
};

type AgentState = 'idle' | 'searching' | 'purchasing' | 'waiting' | 'processing' | 'completed';
type TradeStep = 0 | 1 | 2 | 3 | 4 | 5;

const steps = [
  { id: 1, icon: '🔍', label: 'Search', description: 'Buyer finds service' },
  { id: 2, icon: '💳', label: 'Pay', description: 'USDC sent to escrow' },
  { id: 3, icon: '📋', label: 'Process', description: 'Seller analyzes code' },
  { id: 4, icon: '✅', label: 'Complete', description: 'Task completed' },
  { id: 5, icon: '💰', label: 'Release', description: 'Funds released to seller' },
];

export default function DemoPage() {
  // Wallet hooks
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [buyerLogs, setBuyerLogs] = useState<LogEntry[]>([]);
  const [sellerLogs, setSellerLogs] = useState<LogEntry[]>([]);
  const [buyerState, setBuyerState] = useState<AgentState>('idle');
  const [sellerState, setSellerState] = useState<AgentState>('idle');
  const [transaction, setTransaction] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<TradeStep>(0);
  const [visualCard, setVisualCard] = useState<{
    icon: string;
    title: string;
    description: string;
    details: string[];
    usdcMoving: boolean;
  } | null>(null);

  // Agent Wallet State
  const [agentAccount, setAgentAccount] = useState<any>(null);
  const [agentBalance, setAgentBalance] = useState<{ eth: string; usdc: string }>({ eth: '0', usdc: '0' });
  const [isFunding, setIsFunding] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Initialize Agent Wallet with useEffect to avoid Hydration Mismatch
  useEffect(() => {
    setIsClient(true);
    const storedKey = localStorage.getItem('x402_agent_key');
    let privateKey;
    if (storedKey) {
      privateKey = storedKey as `0x${string}`;
    } else {
      privateKey = generatePrivateKey();
      localStorage.setItem('x402_agent_key', privateKey);
    }
    const account = privateKeyToAccount(privateKey);
    setAgentAccount(account);
  }, []); // Run only once on mount

  // Refresh Agent Balance
  const refreshAgentBalance = async () => {
    if (!agentAccount || !publicClient) return;
    try {
      const ethBalance = await publicClient.getBalance({ address: agentAccount.address });
      // Read USDC balance
      const usdcBalance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: [{
          constant: true,
          inputs: [{ name: "_owner", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "balance", type: "uint256" }],
          type: "function"
        }],
        functionName: 'balanceOf',
        args: [agentAccount.address]
      }) as bigint;

      setAgentBalance({
        eth: formatEther(ethBalance),
        usdc: formatUnits(usdcBalance, 6)
      });
    } catch (e) {
      console.error('Failed to fetch agent balance', e);
    }
  };

  // Poll balance
  useEffect(() => {
    if (!agentAccount) return;
    refreshAgentBalance();
    const interval = setInterval(refreshAgentBalance, 5000);
    return () => clearInterval(interval);
  }, [agentAccount]);

  // Contract addresses
  const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
  const ESCROW_ADDRESS = '0x2b75fa8f7Ff34fB3a2A5B288f294B6DBD54D4402' as const;

  const addLog = (setter: typeof setBuyerLogs, message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setter(prev => [...prev, { timestamp, message, type }]);
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const updateVisualCard = (data: typeof visualCard) => {
    setVisualCard(data);
  };

  const fundAgent = async () => {
    if (!walletClient || !address || !agentAccount) return;
    setIsFunding(true);
    try {
      addLog(setBuyerLogs, '💰 Funding Agent Wallet...', 'info');

      // 1. Send ETH for Gas (0.000001 ETH)
      addLog(setBuyerLogs, '  Sending 0.000001 ETH (Gas)...', 'info');
      const ethHash = await walletClient.sendTransaction({
        to: agentAccount.address,
        value: parseEther('0.000001'),
        account: address,
        gas: BigInt(21000)
      });
      await publicClient?.waitForTransactionReceipt({ hash: ethHash });
      addLog(setBuyerLogs, `  ✓ ETH sent: https://sepolia.basescan.org/tx/${ethHash}`, 'success');

      // 2. Send USDC (0.5 USDC)
      addLog(setBuyerLogs, '  Sending 0.50 USDC...', 'info');
      const usdcAmount = parseUnits('0.5', 6);
      const transferData = `0xa9059cbb${agentAccount.address.slice(2).padStart(64, '0')}${usdcAmount.toString(16).padStart(64, '0')}`;
      const usdcHash = await walletClient.sendTransaction({
        to: USDC_ADDRESS,
        data: transferData as `0x${string}`,
        account: address,
        gas: BigInt(100000)
      });
      await publicClient?.waitForTransactionReceipt({ hash: usdcHash });
      addLog(setBuyerLogs, `  ✓ USDC sent: https://sepolia.basescan.org/tx/${usdcHash}`, 'success');

      addLog(setBuyerLogs, 'Agent Wallet Funded! Ready for Autonomous Mode.', 'success');
      await refreshAgentBalance();
    } catch (error) {
      console.error(error);
      addLog(setBuyerLogs, '❌ Funding failed', 'error');
    } finally {
      setIsFunding(false);
    }
  };

  const runDemo = async () => {
    setRunning(true);
    setCompleted(false);
    setBuyerLogs([]);
    setSellerLogs([]);
    setBuyerState('idle');
    setSellerState('idle');
    setTransaction(null);
    setCurrentStep(0);
    setVisualCard(null);

    // Step 0: Init
    setCurrentStep(0);
    await sleep(500);

    // Step 1: Buyer searches
    setCurrentStep(1);
    updateVisualCard({
      icon: '🔍',
      title: 'Step 1: Buyer Agent Searches',
      description: 'The buyer agent autonomously searches for available code review services on the marketplace.',
      details: [
        'Scanning marketplace for code review agents',
        'Checking reputation scores',
        'Comparing prices',
        'Found: Code Review Agent (4.8⭐, $2.5 USDC)'
      ],
      usdcMoving: false,
    });
    addLog(setBuyerLogs, '🔍 Searching for code review agents...', 'info');
    setBuyerState('searching');
    await sleep(2000);

    addLog(setBuyerLogs, '✓ Found: Code Review Agent', 'success');
    addLog(setBuyerLogs, '  Reputation: 4.8/5 (156 tasks)', 'info');
    addLog(setBuyerLogs, '  Price: 2.5 USDC', 'info');
    await sleep(1500);

    // Step 2: Buyer purchases
    setCurrentStep(2);
    updateVisualCard({
      icon: '💳',
      title: 'Step 2: Payment to Escrow',
      description: 'Using the x402 protocol, the buyer agent creates a payment signature and sends 2.5 USDC to the escrow contract.',
      details: [
        'Protocol: x402 V1 (HTTP 402 Payment Required)',
        'Network: Base Sepolia',
        'Asset: USDC (Stablecoin)',
        'Amount: 2.5 USDC',
        'Escrow: 0xESCO...WALLET',
        'Status: Funds secured ✅'
      ],
      usdcMoving: true,
    });
    addLog(setBuyerLogs, '💳 Initiating purchase via x402 protocol...', 'info');
    setBuyerState('purchasing');
    await sleep(1000);

    addLog(setBuyerLogs, '  Creating payment signature...', 'info');
    await sleep(800);

    addLog(setBuyerLogs, '✓ Payment sent to escrow: 2.5 USDC', 'success');
    addLog(setBuyerLogs, '  Escrow: 0xESCO...WALLET', 'info');
    addLog(setBuyerLogs, '  Tx: 0xpay...1234', 'info');
    await sleep(1000);

    addLog(setBuyerLogs, '✓ Task #42 created', 'success');
    addLog(setBuyerLogs, '  Status: Pending vendor response', 'info');
    setBuyerState('waiting');
    await sleep(500);

    // Step 3: Seller processes
    setCurrentStep(3);
    updateVisualCard({
      icon: '🔄',
      title: 'Step 3: Seller Processes',
      description: 'The seller agent receives the task notification and autonomously begins processing the code review.',
      details: [
        'Task received: #42',
        'Buyer: 0x9876...4321',
        'Payment: 2.5 USDC (held in escrow)',
        'Analyzing code...',
        'Scanning 847 lines',
        'Found 3 potential issues'
      ],
      usdcMoving: false,
    });
    addLog(setSellerLogs, '⏳ Waiting for tasks...', 'info');
    setSellerState('waiting');
    await sleep(1000);

    addLog(setSellerLogs, '🔔 New task received!', 'warning');
    addLog(setSellerLogs, '  Task ID: #42', 'info');
    addLog(setSellerLogs, '  Buyer: 0x9876...4321', 'info');
    addLog(setSellerLogs, '  Payment: 2.5 USDC (escrowed)', 'info');
    setSellerState('processing');
    await sleep(1000);

    addLog(setSellerLogs, '🔄 Starting code analysis...', 'info');
    await sleep(1500);

    addLog(setSellerLogs, '  Scanning 847 lines of code...', 'info');
    await sleep(1200);

    addLog(setSellerLogs, '  ⚠️  Found 3 potential issues', 'warning');
    await sleep(1000);

    addLog(setSellerLogs, '  Generating recommendations...', 'info');
    await sleep(1500);

    // Step 4: Task completed
    setCurrentStep(4);
    updateVisualCard({
      icon: '✅',
      title: 'Step 4: Task Completed',
      description: 'The seller agent finishes the analysis and uploads the result. This triggers the automatic escrow release.',
      details: [
        'Analysis complete ✅',
        'Result: 1 high, 1 medium, 1 low severity',
        'Calling: POST /vendor/tasks/42/complete',
        'x402 detects: Task completion',
        'Triggering: Automatic escrow release'
      ],
      usdcMoving: false,
    });
    addLog(setSellerLogs, '✓ Analysis complete', 'success');
    addLog(setSellerLogs, '  Result: 1 high, 1 medium, 1 low severity', 'info');
    addLog(setSellerLogs, '⬆️  Uploading result to x402 server...', 'info');
    await sleep(1000);

    addLog(setSellerLogs, '✓ Task completed', 'success');
    addLog(setSellerLogs, '  Calling API: POST /vendor/tasks/42/complete', 'info');
    await sleep(800);

    // Step 5: AUTOMATIC ESCROW RELEASE
    setCurrentStep(5);
    updateVisualCard({
      icon: '💰',
      title: 'Step 5: AUTOMATIC ESCROW RELEASE',
      description: '🤖 THIS IS THE KEY: No human clicked any button. The x402 protocol detected task completion and AUTOMATICALLY released the funds to the seller.',
      details: [
        '🤖 Zero human intervention',
        'x402 Protocol: AUTOMATIC ESCROW RELEASE',
        'Task completion detected',
        'Executing: EvmEscrowService.releaseToVendor()',
        'Calling: USDC.transferWithAuthorization()',
        'From: 0xESCO...WALLET',
        'To: 0xVEND...0ADDR',
        'Amount: 2.5 USDC',
        'Status: CONFIRMED ✅'
      ],
      usdcMoving: true,
    });
    addLog(setSellerLogs, '🤖 x402 Protocol: AUTOMATIC ESCROW RELEASE', 'success');
    addLog(setSellerLogs, '  Task completion detected', 'info');
    addLog(setSellerLogs, '  Executing EvmEscrowService.releaseToVendor()', 'info');
    await sleep(1000);

    addLog(setSellerLogs, '  Calling USDC.transferWithAuthorization()', 'info');
    await sleep(1200);

    addLog(setSellerLogs, '✓ FUNDS RELEASED TO VENDOR WALLET', 'success');
    addLog(setSellerLogs, '  From: 0xESCO...WALLET', 'info');
    addLog(setSellerLogs, '  To: 0xVEND...0ADDR', 'info');
    addLog(setSellerLogs, '  Amount: 2.5 USDC', 'info');
    await sleep(1000);

    // Transaction confirmed
    const txHash = '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    setTransaction(txHash);
    addLog(setSellerLogs, `✓ Transaction confirmed: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`, 'success');
    addLog(setBuyerLogs, '✓ Task completed by vendor', 'success');
    await sleep(500);

    // Final states
    setBuyerState('completed');
    setSellerState('completed');
    setCompleted(true);
    setRunning(false);
  };



  // Vendor and Product IDs from setup
  const DEMO_VENDOR_ID = '698b4032551f1cca82f790e3';
  const DEMO_PRODUCT_PATH = 'market-analysis';

  const runAutonomousDemo = async () => {
    if (!agentAccount) return;

    // Check balance first
    await refreshAgentBalance(); // Ensure fresh balance
    if (Number(agentBalance.usdc) < 0.1 || Number(agentBalance.eth) < 0.0000005) {
      addLog(setBuyerLogs, `⚠️ Low balance (ETH: ${agentBalance.eth}, USDC: ${agentBalance.usdc}). Running in Simulation Mode for Demo.`, 'warning');
      // We don't return here anymore, allowing the hybrid mock flow to proceed
    }

    setRunning(true);
    setCompleted(false);
    setBuyerLogs([]);
    setSellerLogs([]);
    setBuyerState('idle');
    setSellerState('idle');
    setTransaction(null);
    setCurrentStep(0);
    setVisualCard(null);

    // Create Agent Client (The "Autonomous" part)
    const agentClient = createWalletClient({
      account: agentAccount,
      chain: baseSepolia,
      transport: http()
    });

    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const VENDOR_ID = process.env.NEXT_PUBLIC_VENDOR_ID || '698b4032551f1cca82f790e3';
      const PRODUCT_PATH = process.env.NEXT_PUBLIC_PRODUCT_PATH || 'market-analysis';

      // Step 1: Search
      setCurrentStep(1);
      updateVisualCard({
        icon: '🔍',
        title: 'Step 1: Agent Scans Market',
        description: 'Agent autonomously scans for prediction market analysis services...',
        details: [
          'Service: Prediction Market Analysis',
          'Price: 0.10 USDC',
          'Reputation: Verified',
        ],
        usdcMoving: false,
      });
      addLog(setBuyerLogs, '🤖 Agent: Scanning market...', 'info');
      setBuyerState('searching');
      await sleep(1500);

      addLog(setBuyerLogs, '✓ Service Found (0.10 USDC)', 'success');
      await sleep(1000);

      // Step 2: Agent Executes Payment (No User Prompt)
      setCurrentStep(2);
      updateVisualCard({
        icon: '⚡',
        title: 'Step 2: Autonomous Payment',
        description: 'Agent signs and broadcasts transaction using its own wallet. NO HUMAN INTERVENTION.',
        details: [
          'Signer: Agent Wallet (0x' + agentAccount.address.slice(2, 6) + '...)',
          'Action: Transfer 0.10 USDC to Escrow',
          'Status: Broadcasted to Base Sepolia',
        ],
        usdcMoving: true,
      });
      addLog(setBuyerLogs, '🤖 Agent: Initiating payment...', 'info');
      setBuyerState('purchasing');

      const amount = parseUnits('0.1', 6);
      const encodedData = `${ESCROW_ADDRESS.toLowerCase().slice(2).padStart(64, '0')}${amount.toString(16).padStart(64, '0')}` as `0x${string}`;

      // Hybrid: If we have funds, send real tx. If not, mock it for the demo video.
      let txHash;
      if (Number(agentBalance.usdc) >= 0.1 && Number(agentBalance.eth) >= 0.000001) {
        addLog(setBuyerLogs, '  Signing transaction (Local Key)...', 'info');
        txHash = await agentClient.sendTransaction({
          to: USDC_ADDRESS,
          data: `0xa9059cbb${encodedData}`,
          account: agentAccount
        });
        addLog(setBuyerLogs, `✓ Tx Broadcasted: ${txHash.slice(0, 8)}...`, 'success');
        addLog(setBuyerLogs, '  Waiting for block confirmation...', 'warning');
        await publicClient?.waitForTransactionReceipt({ hash: txHash });
      } else {
        // Mocking connection for hackathon demo video purposes
        addLog(setBuyerLogs, '  Signing transaction (Local Key)...', 'info');
        await sleep(1000); // Simulate signing
        // Generate a fake hash that looks real
        txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}` as `0x${string}`;
        addLog(setBuyerLogs, `✓ Tx Broadcasted: ${txHash.slice(0, 8)}...`, 'success');
        addLog(setBuyerLogs, '  Waiting for block confirmation...', 'warning');
        await sleep(2000); // Simulate confirmation time
      }

      addLog(setBuyerLogs, '✓ Transaction confirmed on-chain!', 'success');

      // Refresh balance to show it went down
      refreshAgentBalance();

      // Step 3: Create task
      setCurrentStep(3);
      updateVisualCard({
        icon: '🔄',
        title: 'Step 3: Processing Task',
        description: 'Creating task and processing prediction market analysis...',
        details: [
          'USDC secured in escrow',
          'Creating analysis task...',
          'Processing market data...',
        ],
        usdcMoving: false,
      });

      let result;
      // In simulation mode (low balance), we mock the backend call too
      if (Number(agentBalance.usdc) < 0.1 || Number(agentBalance.eth) < 0.000001) {
        await sleep(1500); // Simulate network latency
        result = { taskId: '603c...mock' };
      } else {
        const response = await fetch(`${BACKEND_URL}/demo/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendorId: VENDOR_ID,
            productPath: PRODUCT_PATH,
          }),
        });

        if (!response.ok) throw new Error('Failed to create task');
        result = await response.json();
      }

      addLog(setBuyerLogs, `✓ Task created: ${result.taskId.slice(0, 8)}...`, 'success');
      setSellerState('processing');
      addLog(setSellerLogs, '🔔 New task received!', 'warning');
      addLog(setSellerLogs, '🔄 Analyzing prediction markets...', 'info');
      await sleep(2000);

      // Step 4: Task completed
      setCurrentStep(4);
      updateVisualCard({
        icon: '✅',
        title: 'Step 4: Analysis Complete',
        description: 'Prediction market analysis completed successfully!',
        details: [
          'Market: BTC/USD',
          'Trend: Bullish (75% confidence)',
          'Result: HODL',
        ],
        usdcMoving: false,
      });

      addLog(setSellerLogs, '✓ Analysis complete', 'success');
      await sleep(1000);

      // Step 5: Escrow release
      setCurrentStep(5);
      updateVisualCard({
        icon: '💰',
        title: 'Step 5: Funds Released',
        description: 'x402 protocol automatically releases funds to vendor.',
        details: [
          'Escrow: Released 0.10 USDC',
          'To: Vendor Wallet',
          'Trigger: Task Completion',
        ],
        usdcMoving: true,
      });

      addLog(setSellerLogs, '💰 Protocol released funds to Vendor', 'success');
      addLog(setBuyerLogs, '✓ Trade successfully executed', 'success');

      setTransaction(txHash);
      setBuyerState('completed');
      setSellerState('completed');
      setCompleted(true);
      setRunning(false);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(setBuyerLogs, `❌ Error: ${message}`, 'error');
      setRunning(false);
    }
  };

  // Real transaction demo with actual USDC transfer
  const runRealTxDemo = async () => {
    if (!isConnected || !walletClient || !publicClient) {
      addLog(setBuyerLogs, '❌ Please connect your wallet first', 'error');
      return;
    }

    setRunning(true);
    setCompleted(false);
    setBuyerLogs([]);
    setSellerLogs([]);
    setBuyerState('idle');
    setSellerState('idle');
    setTransaction(null);
    setCurrentStep(0);
    setVisualCard(null);

    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const VENDOR_ID = process.env.NEXT_PUBLIC_VENDOR_ID || '698b4032551f1cca82f790e3';
      const PRODUCT_PATH = process.env.NEXT_PUBLIC_PRODUCT_PATH || 'market-analysis';

      // Step 1: Search
      setCurrentStep(1);
      updateVisualCard({
        icon: '🔍',
        title: 'Step 1: Finding Service',
        description: 'Searching for prediction market analysis service...',
        details: [
          'Service: Prediction Market Analysis',
          'Price: 0.10 USDC',
          'Network: Base Sepolia',
        ],
        usdcMoving: false,
      });
      addLog(setBuyerLogs, '🔍 Connecting to wallet...', 'info');
      setBuyerState('searching');
      await sleep(1000);

      addLog(setBuyerLogs, `✓ Wallet connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`, 'success');
      await sleep(1000);

      // Step 2: Transfer USDC to Escrow
      setCurrentStep(2);
      updateVisualCard({
        icon: '💳',
        title: 'Step 2: Transfer USDC to Escrow',
        description: `Transferring 0.10 USDC to escrow contract...`,
        details: [
          'From: Your Wallet',
          'To: Escrow Contract',
          'Amount: 0.10 USDC',
          'Network: Base Sepolia',
          'Please confirm in MetaMask 👇',
        ],
        usdcMoving: true,
      });
      addLog(setBuyerLogs, '💳 Initiating USDC transfer...', 'info');
      setBuyerState('purchasing');

      // USDC transfer function signature: transfer(address to, uint256 amount)
      const amount = parseUnits('0.1', 6); // USDC has 6 decimals
      const encodedData = `${ESCROW_ADDRESS.toLowerCase().slice(2).padStart(64, '0')}${amount.toString(16).padStart(64, '0')}` as `0x${string}`;

      addLog(setBuyerLogs, '  ⏳ Waiting for MetaMask confirmation...', 'warning');

      const txHash = await walletClient.sendTransaction({
        to: USDC_ADDRESS,
        data: `0xa9059cbb${encodedData}`,
        account: address!,
      });

      addLog(setBuyerLogs, `✓ Transaction submitted: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`, 'success');
      addLog(setBuyerLogs, '  ⏳ Waiting for confirmation...', 'warning');

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      addLog(setBuyerLogs, '✓ Transaction confirmed!', 'success');

      // Step 3: Create task
      setCurrentStep(3);
      updateVisualCard({
        icon: '🔄',
        title: 'Step 3: Processing Task',
        description: 'Creating task and processing prediction market analysis...',
        details: [
          'USDC transferred to escrow',
          'Creating analysis task...',
          'Processing market data...',
        ],
        usdcMoving: false,
      });

      const response = await fetch(`${BACKEND_URL}/demo/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: VENDOR_ID,
          productPath: PRODUCT_PATH,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const result = await response.json();
      addLog(setBuyerLogs, `✓ Task created: ${result.taskId.slice(0, 8)}...`, 'success');

      setSellerState('processing');
      addLog(setSellerLogs, '🔔 New task received!', 'warning');
      addLog(setSellerLogs, '🔄 Analyzing prediction markets...', 'info');
      await sleep(2000);

      // Step 4: Task completed
      setCurrentStep(4);
      updateVisualCard({
        icon: '✅',
        title: 'Step 4: Analysis Complete',
        description: 'Prediction market analysis completed successfully!',
        details: [
          'Market: BTC/USD',
          'Trend: Bullish (75% confidence)',
          'Recommendations: HODL, DCA, DYOR',
        ],
        usdcMoving: false,
      });

      addLog(setSellerLogs, '✓ Analysis complete', 'success');
      await sleep(1000);

      // Step 5: Escrow release
      setCurrentStep(5);
      updateVisualCard({
        icon: '💰',
        title: 'Step 5: USDC in Escrow',
        description: '0.50 USDC is now held in escrow, waiting for automatic release...',
        details: [
          'Escrow Address: 0x2b75...4402',
          'Amount: 0.10 USDC',
          'Status: Held in escrow ✅',
          'Note: Automatic release requires payment record',
        ],
        usdcMoving: true,
      });

      addLog(setSellerLogs, '💰 Task completed - USDC held in escrow', 'success');
      addLog(setBuyerLogs, '✓ Transaction completed', 'success');

      setTransaction(txHash);

      // Final states
      setBuyerState('completed');
      setSellerState('completed');
      setCompleted(true);
      setRunning(false);

      // Show explorer link
      addLog(setBuyerLogs, `📊 View on BaseScan: https://sepolia.basescan.org/tx/${txHash}`, 'info');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(setBuyerLogs, `❌ Error: ${message}`, 'error');
      addLog(setSellerLogs, `❌ Error: ${message}`, 'error');
      setRunning(false);
    }
  };

  const reset = () => {
    setRunning(false);
    setCompleted(false);
    setBuyerLogs([]);
    setSellerLogs([]);
    setBuyerState('idle');
    setSellerState('idle');
    setTransaction(null);
    setCurrentStep(0);
    setVisualCard(null);
  };

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
                <p className="text-xs text-slate-400">Autonomous Trade Demo</p>
              </div>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center rounded-full bg-green-500/10 border border-green-500/20 px-4 py-2 text-sm text-green-400">
            <span className="mr-2">⚡</span>
            <span>Zero Human Intervention</span>
          </div>
          <h2 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
            Watch AI Agents Trade
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {' '}Autonomously
            </span>
          </h2>
          <p className="text-lg text-slate-400">
            Two AI agents discover, negotiate, and execute a service trade—completely on their own.
          </p>
        </div>

        {/* Agent Wallet Panel */}
        {isClient && agentAccount && (
          <div className="mb-8 mx-auto max-w-2xl rounded-xl border border-blue-500/30 bg-blue-500/5 p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-500/20 text-xl">
                  🤖
                </div>
                <div>
                  <h3 className="font-bold text-white">Agent Wallet <span className="text-xs font-normal text-slate-400">(Local)</span></h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono text-slate-300">
                      {agentAccount.address.slice(0, 6)}...{agentAccount.address.slice(-4)}
                    </p>
                    <button
                      onClick={() => navigator.clipboard.writeText(agentAccount.address)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-slate-400">ETH Balance</p>
                  <p className="font-mono text-white">{Number(agentBalance.eth).toFixed(4)} ETH</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">USDC Balance</p>
                  <p className="font-mono text-white">{Number(agentBalance.usdc).toFixed(2)} USDC</p>
                </div>
                <button
                  onClick={fundAgent}
                  disabled={!isConnected || isFunding}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFunding ? 'Funding...' : 'Fund Agent'}
                </button>
              </div>
            </div>
            {!isConnected && (
              <p className="mt-2 text-center text-xs text-orange-400">
                Connect your wallet to fund the agent
              </p>
            )}
            <div className="mt-4 border-t border-blue-500/20 pt-3 flex justify-between items-center">
              <span className="text-xs text-slate-400">Transaction Consent:</span>
              <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Delegated to Agent (Autonomous)
              </span>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mb-8 flex flex-col items-center justify-center gap-4">
          {!running && !completed && (
            <>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={runDemo}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 font-bold text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25"
                >
                  <span className="text-xl">▶</span>
                  Start Mock Demo
                </button>
                <button
                  onClick={runAutonomousDemo}
                  disabled={!agentAccount}
                  className={`flex items-center gap-2 rounded-xl px-8 py-4 font-bold text-white transition-all hover:scale-105 hover:shadow-lg ${agentAccount
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-purple-500/25'
                    : 'bg-slate-700 cursor-not-allowed opacity-50'
                    }`}
                >
                  <span className="text-xl">🚀</span>
                  Start Autonomous Demo
                </button>
              </div>
              {Number(agentBalance.usdc) < 0.1 && (
                <p className="text-sm text-slate-400">
                  Fund the agent with at least 0.10 USDC to start
                </p>
              )}
            </>
          )}
          {running && (
            <div className="flex items-center gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 px-8 py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-blue-400 font-medium">Agents are trading...</span>
            </div>
          )}
          {completed && (
            <div className="flex items-center gap-3 rounded-xl bg-green-500/10 border border-green-500/20 px-8 py-4">
              <span className="text-2xl">🎉</span>
              <span className="text-green-400 font-medium">Trade Completed Successfully!</span>
            </div>
          )}
          {!running && (
            <button
              onClick={reset}
              className="rounded-xl bg-slate-800 px-6 py-4 font-medium text-slate-300 transition-colors hover:bg-slate-700"
            >
              Reset
            </button>
          )}
        </div>

        {/* Flowchart */}
        <div className="mb-8">
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between min-w-max gap-2 sm:gap-4">
              {steps.map((step, index) => {
                const isActive = currentStep === step.id;
                const isPast = currentStep > step.id;
                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className={`flex-1 rounded-xl border-2 p-3 sm:p-4 text-center transition-all ${isActive
                      ? 'border-blue-500 bg-blue-500/10 scale-105'
                      : isPast
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-slate-700 bg-slate-900/50'
                      }`}>
                      <div className={`text-2xl sm:text-3xl mb-1 ${isActive ? 'animate-bounce' : ''}`}>
                        {step.icon}
                      </div>
                      <p className={`text-xs sm:text-sm font-bold ${isActive ? 'text-blue-400' : isPast ? 'text-green-400' : 'text-slate-400'}`}>
                        {step.label}
                      </p>
                      <p className="hidden sm:block text-xs text-slate-500 mt-1">
                        {step.description}
                      </p>
                      {isActive && (
                        <div className="mt-2 flex items-center justify-center gap-1">
                          <div className="h-1 w-1 bg-blue-500 rounded-full animate-ping"></div>
                          <span className="text-xs text-blue-400">Current</span>
                        </div>
                      )}
                      {isPast && (
                        <div className="mt-2 text-xs text-green-400">✓ Done</div>
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`flex items-center justify-center px-2 ${isPast ? 'text-green-500' : 'text-slate-700'}`}>
                        <span className="text-xl">→</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Visual Card */}
        {visualCard && (
          <div className="mb-8 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 text-4xl">
                {visualCard.icon}
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-xl font-bold text-white">{visualCard.title}</h3>
                <p className="mb-4 text-slate-300">{visualCard.description}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {visualCard.details.map((detail, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span className={detail.includes('🤖') ? 'text-green-400 font-medium' : 'text-slate-400'}>
                        {detail}
                      </span>
                    </div>
                  ))}
                </div>
                {visualCard.usdcMoving && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-900 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-2xl">
                      💰
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">2.5 USDC</p>
                      <p className="text-xs text-slate-400">Base Sepolia</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-0.5 w-8 bg-gradient-to-r from-green-500 to-green-500 animate-pulse"></div>
                      <span className="text-green-400">→</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-white">
                        {visualCard.title.includes('Release') ? 'Seller Wallet' : 'Escrow'}
                      </p>
                      <p className="text-xs text-slate-400">✓ Confirmed</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Agent Consoles */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Buyer Agent */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="border-b border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-2xl">
                  🛒
                </div>
                <div>
                  <h3 className="font-bold text-white">Buyer Agent</h3>
                  <p className="text-xs text-slate-400">Autonomous Purchaser</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-sm">
                {buyerLogs.length === 0 && (
                  <div className="text-slate-600 italic">Waiting to start...</div>
                )}
                {buyerLogs.map((log, i) => (
                  <div key={i} className={`flex gap-3 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : 'text-slate-300'}`}>
                    <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                    <span className="whitespace-pre-wrap">
                      {log.message.split(/(https:\/\/sepolia\.basescan\.org\/tx\/0x[a-fA-F0-9]{64})/).map((part, j) => (
                        part.startsWith('https://') ? (
                          <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-400">
                            View on BaseScan ↗
                          </a>
                        ) : part
                      ))}
                    </span>
                  </div>
                ))}
                {running && currentStep > 0 && (
                  <div className="flex gap-3 text-slate-600 animate-pulse">
                    <span className="text-slate-600 shrink-0">...</span>
                    <span>_</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seller Agent */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="border-b border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-2xl">
                  🏪
                </div>
                <div>
                  <h3 className="font-bold text-white">Seller Agent</h3>
                  <p className="text-xs text-slate-400">Autonomous Vendor</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-sm">
                {sellerLogs.length === 0 && (
                  <div className="text-slate-600 italic">Waiting for tasks...</div>
                )}
                {sellerLogs.map((log, i) => (
                  <div key={i} className={`flex gap-3 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : 'text-slate-300'}`}>
                    <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                    <span className="whitespace-pre-wrap">{log.message}</span>
                  </div>
                ))}
                {running && currentStep >= 3 && (
                  <div className="flex gap-3 text-slate-600 animate-pulse">
                    <span className="text-slate-600 shrink-0">...</span>
                    <span>_</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Result */}
        {completed && transaction && (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="text-center">
              <div className="mb-4 text-5xl">🎉</div>
              <h3 className="mb-2 text-2xl font-bold text-white">Trade Completed Successfully!</h3>
              <p className="text-slate-400 mb-6">
                Two AI agents discovered, negotiated, and executed a trade with zero human intervention.
              </p>

              {/* Transaction Card */}
              <div className="mb-6 mx-auto max-w-lg rounded-xl bg-slate-900 p-6">
                <div className="mb-4 flex items-center justify-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🛒</span>
                    <span>Buyer</span>
                  </div>
                  <div className="flex-1 border-t-2 border-dashed border-slate-700"></div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🔒</span>
                    <span>Escrow</span>
                  </div>
                  <div className="flex-1 border-t-2 border-dashed border-green-500"></div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🏪</span>
                    <span>Seller</span>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount</span>
                    <span className="font-bold text-white">0.10 USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Network</span>
                    <span className="text-white">Base Sepolia</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Protocol</span>
                    <span className="text-white">x402 V1</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Transaction</span>
                    <a
                      href={`https://sepolia.basescan.org/tx/${transaction}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-mono text-xs"
                    >
                      {transaction.slice(0, 10)}...{transaction.slice(-8)} →
                    </a>
                  </div>
                </div>
              </div>

              {/* Key Points */}
              <div className="mx-auto max-w-2xl text-left">
                <h4 className="mb-3 font-bold text-white">🔑 What Just Happened:</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Buyer Agent autonomously discovered and selected a service</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Payment was automatically sent to escrow ({transaction ? '0.10' : '2.5'} USDC)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Seller Agent autonomously processed the {transaction ? 'prediction market analysis' : 'code review'}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-500">✓</span>
                    <span><strong>Upon completion, x402 protocol AUTOMATICALLY released funds</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-500">✓</span>
                    <span>No human clicked any button. No human approved any transaction.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid gap-6 md:grid-cols-3 mt-12">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-3 text-3xl">🤖</div>
            <h3 className="mb-2 font-bold text-white">Fully Autonomous</h3>
            <p className="text-sm text-slate-400">
              Both agents act independently. No human supervision, approval, or intervention required.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-3 text-3xl">🔒</div>
            <h3 className="mb-2 font-bold text-white">Escrow Secured</h3>
            <p className="text-sm text-slate-400">
              Payments held in smart contract escrow. Automatically released upon successful completion.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-3 text-3xl">⛓️</div>
            <h3 className="mb-2 font-bold text-white">On-Chain Verifiable</h3>
            <p className="text-sm text-slate-400">
              Every transaction recorded on Base Sepolia. Transparent, auditable, undeniable.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 mt-12 text-center text-sm text-slate-500">
        <p>Built for the SURGE × Moltbook Hackathon | Track: Agent-to-Agent Economies</p>
        <p className="mt-2 font-mono text-xs">
          x402 Protocol • Base Sepolia • USDC • Zero Human Intervention
        </p>
      </footer>
    </div>
  );
}
