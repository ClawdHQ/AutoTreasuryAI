/**
 * Treasury API handlers for Next.js App Router.
 *
 * These functions are used by the /api/* route files and run exclusively on
 * the server. They mirror the logic in backend/api/treasury.ts but are
 * bundled inside the Next.js application so the frontend can be deployed as
 * a single service.
 */

import { ethers } from 'ethers';
import {
  TreasuryAgent,
  type TreasuryState,
  type MarketData,
  type Strategy,
} from '@autotreasury/ai-engine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const provider = new ethers.JsonRpcProvider(
  process.env.BSC_TESTNET_RPC ?? 'https://data-seed-prebsc-1-s1.binance.org:8545'
);

const VAULT_ABI = [
  'function getPortfolioValue() external pure returns (uint256)',
  'function getAllocation() external view returns (tuple(address asset, uint256 amount, uint256 percentage, uint256 valueUSD)[])',
];

const EXECUTOR_ABI = [
  'function getAPRs() external pure returns (uint256 pancakeAPR, uint256 venusAPR, uint256 stakingAPR)',
];

async function fetchTreasuryState(address: string): Promise<TreasuryState> {
  const vault = new ethers.Contract(address, VAULT_ABI, provider);

  const allocationItems: Array<{
    asset: string;
    amount: bigint;
    percentage: bigint;
    valueUSD: bigint;
  }> = await vault.getAllocation();

  // getPortfolioValue() is a placeholder that returns 0; derive the total
  // from the per-asset values to avoid double-counting.
  const totalValueRaw: bigint = await vault.getPortfolioValue();
  const contractTotal = Number(ethers.formatEther(totalValueRaw));

  const assets = allocationItems.map((item) => ({
    symbol: item.asset === ethers.ZeroAddress ? 'BNB' : item.asset,
    address: item.asset,
    balance: item.amount,
    valueUSD: Number(ethers.formatEther(item.valueUSD)),
    percentage: Number(item.percentage) / 100,
  }));

  // Use the contract total when it is non-zero (real deployment);
  // otherwise fall back to summing individual asset values (local dev/testnet).
  const summedValue = assets.reduce((acc, a) => acc + a.valueUSD, 0);
  const totalValueUSD = contractTotal > 0 ? contractTotal : summedValue;

  return {
    totalValueUSD,
    assets,
    currentAllocation: { pancakeLP: 0, venusLending: 0, bnbStaking: 0, idle: 100 },
    historicalPerformance: [],
  };
}

async function fetchMarketData(): Promise<MarketData> {
  const executorAddress = process.env.STRATEGY_EXECUTOR_ADDRESS;
  let pancakeAPR = 15;
  let venusAPR = 5;
  let stakingAPR = 5;

  if (executorAddress && ethers.isAddress(executorAddress)) {
    try {
      const executor = new ethers.Contract(executorAddress, EXECUTOR_ABI, provider);
      const aprs: [bigint, bigint, bigint] = await executor.getAPRs();
      if (aprs[0] > 0n) pancakeAPR = Number(aprs[0]) / 100;
      if (aprs[1] > 0n) venusAPR = Number(aprs[1]) / 100;
      if (aprs[2] > 0n) stakingAPR = Number(aprs[2]) / 100;
    } catch {
      // Fall through to defaults
    }
  }

  return {
    pancakeAPR,
    venusAPR,
    stakingAPR,
    volatility: { bnb: 0.15, usdt: 0.001 },
  };
}

// ─── GET /api/treasury/:address ───────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { address: string } }
): Promise<Response> {
  try {
    const { address } = params;

    if (!ethers.isAddress(address)) {
      return jsonResponse({ error: 'Invalid vault address' }, { status: 400 });
    }

    const [treasuryState, marketData] = await Promise.all([
      fetchTreasuryState(address),
      fetchMarketData(),
    ]);

    const agent = new TreasuryAgent(process.env.OPENAI_API_KEY ?? '');
    const strategy: Strategy = await agent.analyzeAndPropose(
      treasuryState,
      marketData,
      'Optimize for balanced growth',
      'medium'
    );

    const currentAPR =
      (strategy.targetAllocation.pancakeLP * marketData.pancakeAPR +
        strategy.targetAllocation.venusLending * marketData.venusAPR +
        strategy.targetAllocation.bnbStaking * marketData.stakingAPR) /
      100;

    return jsonResponse({
      totalValue: treasuryState.totalValueUSD,
      change24h: 0,
      currentAPR,
      riskScore: strategy.riskLevel,
      allocation: treasuryState.currentAllocation,
      assets: treasuryState.assets.map((a) => ({
        ...a,
        balance: typeof a.balance === 'bigint' ? a.balance.toString() : a.balance,
      })),
      aiStrategy: strategy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, { status: 500 });
  }
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────

export async function POST_chat(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      message: string;
      address?: string;
      riskTolerance?: string;
    };

    const { message, address, riskTolerance = 'medium' } = body;

    if (!message || typeof message !== 'string') {
      return jsonResponse({ error: 'message is required' }, { status: 400 });
    }

    let treasuryState: TreasuryState = {
      totalValueUSD: 0,
      assets: [],
      currentAllocation: { pancakeLP: 0, venusLending: 0, bnbStaking: 0, idle: 100 },
      historicalPerformance: [],
    };

    if (address && ethers.isAddress(address)) {
      treasuryState = await fetchTreasuryState(address);
    }

    const marketData = await fetchMarketData();
    const agent = new TreasuryAgent(process.env.OPENAI_API_KEY ?? '');
    const strategy = await agent.analyzeAndPropose(
      treasuryState,
      marketData,
      message,
      riskTolerance
    );

    return jsonResponse({
      strategy,
      formattedSummary: agent.formatStrategySummary(strategy),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, { status: 500 });
  }
}

// ─── POST /api/execute ────────────────────────────────────────────────────────

export async function POST_execute(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { strategy: Strategy };
    const { strategy } = body;

    if (!strategy || !Array.isArray(strategy.actions)) {
      return jsonResponse({ error: 'strategy with actions is required' }, { status: 400 });
    }

    const agent = new TreasuryAgent(process.env.OPENAI_API_KEY ?? '');
    const encodedActions = agent.buildExecutionPlan(strategy);

    return jsonResponse({ encodedActions });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, { status: 500 });
  }
}

// ─── GET /api/market-data ─────────────────────────────────────────────────────

export async function GET_marketData(_request: Request): Promise<Response> {
  try {
    const marketData = await fetchMarketData();
    return jsonResponse(marketData);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, { status: 500 });
  }
}
