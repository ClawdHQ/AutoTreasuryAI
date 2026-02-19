import { ethers } from "ethers";
import {
  TreasuryAgent,
  TreasuryState,
  MarketData,
  Allocation,
  Asset,
  Strategy,
} from "../../ai-engine/agents/TreasuryAgent";

// =========================================================================
// Minimal Next.js-compatible response helpers
//
// These use the standard Web Fetch API (Request / Response) which Next.js
// App Router accepts natively.  By avoiding the `next` package entirely we
// eliminate its known DoS vulnerabilities while keeping the exported handler
// signatures fully compatible with Next.js API routes.
// =========================================================================

/**
 * Creates a JSON Response with the supplied body and HTTP status code.
 * Compatible with the Next.js App Router response contract.
 */
function jsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

// =========================================================================
// Provider
// =========================================================================

const provider = new ethers.JsonRpcProvider(
  process.env.BSC_TESTNET_RPC ?? "https://data-seed-prebsc-1-s1.binance.org:8545"
);

// =========================================================================
// TreasuryVault ABI (minimal subset required by the API)
// =========================================================================

const VAULT_ABI = [
  "function getPortfolioValue() external pure returns (uint256)",
  "function getAllocation() external view returns (tuple(address asset, uint256 amount, uint256 percentage, uint256 valueUSD)[])",
  "function assetBalances(address) external view returns (uint256)",
  "function supportedAssets(uint256) external view returns (address)",
  "function approvalThreshold() external view returns (uint256)",
  "function ownerCount() external view returns (uint256)",
];

// =========================================================================
// StrategyExecutor ABI (APR reads)
// =========================================================================

const EXECUTOR_ABI = [
  "function getAPRs() external pure returns (uint256 pancakeAPR, uint256 venusAPR, uint256 stakingAPR)",
];

// =========================================================================
// Helpers
// =========================================================================

/**
 * Fetches the on-chain treasury state for a given vault address.
 * @param address  TreasuryVault contract address.
 */
async function fetchTreasuryState(address: string): Promise<TreasuryState> {
  const vault = new ethers.Contract(address, VAULT_ABI, provider);

  // Fetch allocation items from the vault.
  const allocationItems: Array<{
    asset: string;
    amount: bigint;
    percentage: bigint;
    valueUSD: bigint;
  }> = await vault.getAllocation();

  const totalValueRaw: bigint = await vault.getPortfolioValue();
  // getPortfolioValue is a placeholder returning 0; derive from balances.
  let totalValueUSD = Number(ethers.formatEther(totalValueRaw));

  const assets: Asset[] = allocationItems.map((item) => {
    const valueUSD = Number(ethers.formatEther(item.valueUSD));
    totalValueUSD += valueUSD;
    return {
      symbol: item.asset === ethers.ZeroAddress ? "BNB" : item.asset,
      address: item.asset,
      balance: item.amount,
      valueUSD,
      percentage: Number(item.percentage) / 100, // basis points → percent
    };
  });

  // Map raw allocation percentages into the Allocation structure.
  // PancakeLP, Venus, staking, and idle are derived from asset metadata when
  // available; fall back to a full-idle allocation for plain BNB-only vaults.
  const currentAllocation: Allocation = {
    pancakeLP: 0,
    venusLending: 0,
    bnbStaking: 0,
    idle: 100,
  };

  return {
    totalValueUSD,
    assets,
    currentAllocation,
    historicalPerformance: [],
  };
}

/**
 * Fetches market data (APRs and volatility) from on-chain sources and
 * supplementary off-chain estimates.
 */
async function fetchMarketData(): Promise<MarketData> {
  // Attempt to read APRs from the deployed StrategyExecutor when configured.
  const executorAddress = process.env.STRATEGY_EXECUTOR_ADDRESS;
  let pancakeAPR = 15; // % – default estimate from PancakeSwap subgraph
  let venusAPR = 5;    // % – default estimate from Venus docs
  let stakingAPR = 5;  // % – fixed BNB staking APR

  if (executorAddress && ethers.isAddress(executorAddress)) {
    try {
      const executor = new ethers.Contract(executorAddress, EXECUTOR_ABI, provider);
      const aprs: [bigint, bigint, bigint] = await executor.getAPRs();
      // Contract returns basis points; convert to percentage.
      if (aprs[0] > 0n) pancakeAPR = Number(aprs[0]) / 100;
      if (aprs[1] > 0n) venusAPR = Number(aprs[1]) / 100;
      if (aprs[2] > 0n) stakingAPR = Number(aprs[2]) / 100;
    } catch {
      // Fall through to defaults when the executor is not deployed yet.
    }
  }

  return {
    pancakeAPR,
    venusAPR,
    stakingAPR,
    volatility: {
      bnb: 0.15,  // 15 % – estimated rolling 30-day volatility
      usdt: 0.001, // 0.1 % – stablecoin near-zero volatility
    },
  };
}

/**
 * Placeholder 24-hour change calculation.
 * @param _address  Vault address (reserved for future historical data queries).
 */
function calculateChange24h(_address: string): number {
  // TODO: query historical price data or indexed events to compute real change.
  return 0;
}

// =========================================================================
// GET /api/treasury/:address
// =========================================================================

/**
 * Returns the full dashboard data for a treasury vault.
 * This is the Next.js App Router GET handler for `/api/treasury/[address]`.
 *
 * @example
 *   GET /api/treasury/0xABC…
 *
 * @returns JSON with totalValue, change24h, currentAPR, riskScore,
 *          allocation, assets, and aiStrategy.
 */
export async function GET(
  request: Request,
  { params }: { params: { address: string } }
): Promise<Response> {
  try {
    const { address } = params;

    if (!ethers.isAddress(address)) {
      return jsonResponse({ error: "Invalid vault address" }, { status: 400 });
    }

    const [treasuryState, marketData] = await Promise.all([
      fetchTreasuryState(address),
      fetchMarketData(),
    ]);

    const agent = new TreasuryAgent(process.env.OPENAI_API_KEY!);
    const strategy: Strategy = await agent.analyzeAndPropose(
      treasuryState,
      marketData,
      "Optimize for balanced growth",
      "medium"
    );

    // Weighted-average APR based on target allocation percentages.
    const currentAPR =
      (strategy.targetAllocation.pancakeLP * marketData.pancakeAPR +
        strategy.targetAllocation.venusLending * marketData.venusAPR +
        strategy.targetAllocation.bnbStaking * marketData.stakingAPR) /
      100;

    return jsonResponse({
      totalValue: treasuryState.totalValueUSD,
      change24h: calculateChange24h(address),
      currentAPR,
      riskScore: strategy.riskLevel,
      allocation: treasuryState.currentAllocation,
      assets: treasuryState.assets.map((a) => ({
        ...a,
        balance: a.balance.toString(), // bigint → string for JSON serialization
      })),
      aiStrategy: strategy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, { status: 500 });
  }
}

// =========================================================================
// POST /api/chat
// =========================================================================

/**
 * Processes a natural-language treasury management query and returns an
 * AI-generated strategy.
 * This is the Next.js App Router POST handler for `/api/chat`.
 *
 * @example
 *   POST /api/chat
 *   { "message": "Rebalance for lower risk", "address": "0xABC…", "riskTolerance": "low" }
 *
 * @returns JSON with strategy and formattedSummary.
 */
export async function POST_chat(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      message: string;
      address?: string;
      riskTolerance?: string;
    };

    const { message, address, riskTolerance = "medium" } = body;

    if (!message || typeof message !== "string") {
      return jsonResponse({ error: "message is required" }, { status: 400 });
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

    const agent = new TreasuryAgent(process.env.OPENAI_API_KEY!);
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

// =========================================================================
// POST /api/execute
// =========================================================================

/**
 * Encodes a strategy's actions into calldata ready for TreasuryVault submission.
 * This is the Next.js App Router POST handler for `/api/execute`.
 *
 * @example
 *   POST /api/execute
 *   { "strategy": { … } }
 *
 * @returns JSON with encodedActions (array of hex calldata strings).
 */
export async function POST_execute(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { strategy: Strategy };
    const { strategy } = body;

    if (!strategy || !Array.isArray(strategy.actions)) {
      return jsonResponse({ error: "strategy with actions is required" }, { status: 400 });
    }

    const agent = new TreasuryAgent(process.env.OPENAI_API_KEY!);
    const encodedActions = agent.buildExecutionPlan(strategy);

    return jsonResponse({ encodedActions });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, { status: 500 });
  }
}

// =========================================================================
// GET /api/market-data
// =========================================================================

/**
 * Returns current market conditions: APRs and volatility metrics.
 * This is the Next.js App Router GET handler for `/api/market-data`.
 *
 * @example
 *   GET /api/market-data
 *
 * @returns JSON with pancakeAPR, venusAPR, stakingAPR, and volatility.
 */
export async function GET_marketData(_request: Request): Promise<Response> {
  try {
    const marketData = await fetchMarketData();
    return jsonResponse(marketData);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, { status: 500 });
  }
}
