import OpenAI from "openai";
import { ethers } from "ethers";

// =========================================================================
// Domain Types
// =========================================================================

export interface Asset {
  symbol: string;
  address: string;
  balance: bigint;
  valueUSD: number;
  percentage: number;
}

export interface Allocation {
  pancakeLP: number; // percentage of portfolio
  venusLending: number;
  bnbStaking: number;
  idle: number;
}

export interface Performance {
  timestamp: number;
  totalValueUSD: number;
  apy: number;
}

export interface TreasuryState {
  totalValueUSD: number;
  assets: Asset[];
  currentAllocation: Allocation;
  historicalPerformance: Performance[];
}

export interface MarketData {
  pancakeAPR: number;
  venusAPR: number;
  stakingAPR: number;
  volatility: {
    bnb: number;
    usdt: number;
  };
}

export interface Action {
  type: "swap" | "addLP" | "supply" | "stake";
  params: Record<string, unknown>;
  estimatedGas: bigint;
  priority: number;
}

export interface Strategy {
  name: string;
  description: string;
  targetAllocation: Allocation;
  expectedAPR: number;
  riskLevel: "low" | "medium" | "high";
  actions: Action[];
  reasoning: string;
}

// =========================================================================
// TreasuryAgent
// =========================================================================

/**
 * AI-powered treasury management agent.
 *
 * Analyses the current treasury state and market conditions then proposes
 * optimal, risk-adjusted allocation strategies using GPT-4.
 */
export class TreasuryAgent {
  private readonly openai: OpenAI;
  private readonly systemPrompt: string;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });

    this.systemPrompt = `You are an expert DeFi treasury manager for DAOs and teams on BNB Chain.

Your expertise:
- Portfolio allocation across PancakeSwap LP, Venus Protocol, BNB staking
- Risk management (low, medium, high risk profiles)
- APR optimization
- Gas efficiency
- Market analysis

Available protocols:
1. PancakeSwap V3: Provide liquidity, earn fees (APR varies by pair, typically 10-30%)
2. Venus Protocol: Lend stablecoins/BNB, earn interest (APR typically 3-8%)
3. BNB Staking: Stake BNB with validators (APR ~5%)

Risk Profiles:
- Low Risk: 70% stablecoins in Venus, 20% BNB staking, 10% conservative LP (USDT-BUSD)
- Medium Risk: 40% Venus, 30% BNB staking, 30% medium LP (BNB-USDT)
- High Risk: 20% Venus, 20% staking, 60% high APR LP (volatile pairs)

Your responses should:
1. Analyse current allocation
2. Consider market conditions (APRs, volatility)
3. Match user's risk tolerance
4. Propose specific, executable actions
5. Explain reasoning clearly
6. Estimate expected APR

Always prioritise capital preservation while optimising yield.

Respond ONLY with valid JSON matching this exact schema:
{
  "name": string,
  "description": string,
  "targetAllocation": { "pancakeLP": number, "venusLending": number, "bnbStaking": number, "idle": number },
  "expectedAPR": number,
  "riskLevel": "low" | "medium" | "high",
  "actions": [{ "type": "swap"|"addLP"|"supply"|"stake", "params": {}, "estimatedGas": number, "priority": number }],
  "reasoning": string
}`;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Analyses the treasury state and market data then returns a concrete
   * allocation strategy tailored to the user's goal and risk tolerance.
   *
   * @param treasuryState   Current vault holdings and allocation.
   * @param marketData      Live APRs and volatility metrics.
   * @param userGoal        Plain-English description of the owner's objective.
   * @param riskTolerance   "low" | "medium" | "high"
   * @returns               A fully-formed {@link Strategy} ready for on-chain execution.
   */
  async analyzeAndPropose(
    treasuryState: TreasuryState,
    marketData: MarketData,
    userGoal: string,
    riskTolerance: string
  ): Promise<Strategy> {
    const userMessage = this._buildAnalysisPrompt(
      treasuryState,
      marketData,
      userGoal,
      riskTolerance
    );

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3, // Low temperature for deterministic financial advice
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("No response content from OpenAI");
    }

    return this._parseStrategy(raw);
  }

  /**
   * Builds the on-chain calldata for each action in the proposed strategy so
   * they can be forwarded to the TreasuryVault.
   *
   * @param strategy  Strategy returned by {@link analyzeAndPropose}.
   * @returns         Array of encoded calldata strings (hex).
   */
  buildExecutionPlan(strategy: Strategy): string[] {
    return strategy.actions.map((action) =>
      this._encodeAction(action)
    );
  }

  /**
   * Formats a human-readable summary of the proposed strategy.
   *
   * @param strategy  Strategy to summarise.
   * @returns         Multi-line string suitable for logging / UI display.
   */
  formatStrategySummary(strategy: Strategy): string {
    const alloc = strategy.targetAllocation;
    const lines = [
      `Strategy: ${strategy.name}`,
      `Risk Level: ${strategy.riskLevel.toUpperCase()}`,
      `Expected APR: ${strategy.expectedAPR.toFixed(2)}%`,
      ``,
      `Target Allocation:`,
      `  PancakeSwap LP : ${alloc.pancakeLP}%`,
      `  Venus Lending  : ${alloc.venusLending}%`,
      `  BNB Staking    : ${alloc.bnbStaking}%`,
      `  Idle           : ${alloc.idle}%`,
      ``,
      `Actions (${strategy.actions.length} total):`,
      ...strategy.actions
        .sort((a, b) => a.priority - b.priority)
        .map((a, i) => `  ${i + 1}. [${a.type}] gas≈${a.estimatedGas}`),
      ``,
      `Reasoning: ${strategy.reasoning}`,
    ];

    return lines.join("\n");
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private _buildAnalysisPrompt(
    state: TreasuryState,
    market: MarketData,
    goal: string,
    risk: string
  ): string {
    const assetSummary = state.assets
      .map(
        (a) =>
          `  ${a.symbol}: ${ethers.formatUnits(a.balance, 18)} (${a.percentage.toFixed(1)}% of portfolio, $${a.valueUSD.toFixed(2)})`
      )
      .join("\n");

    return [
      `Treasury Analysis Request`,
      ``,
      `Total Value: $${state.totalValueUSD.toFixed(2)}`,
      ``,
      `Current Holdings:`,
      assetSummary,
      ``,
      `Current Allocation:`,
      `  PancakeSwap LP: ${state.currentAllocation.pancakeLP}%`,
      `  Venus Lending : ${state.currentAllocation.venusLending}%`,
      `  BNB Staking   : ${state.currentAllocation.bnbStaking}%`,
      `  Idle          : ${state.currentAllocation.idle}%`,
      ``,
      `Market Conditions:`,
      `  PancakeSwap APR: ${market.pancakeAPR}%`,
      `  Venus APR      : ${market.venusAPR}%`,
      `  BNB Staking APR: ${market.stakingAPR}%`,
      `  BNB Volatility : ${(market.volatility.bnb * 100).toFixed(1)}%`,
      `  USDT Volatility: ${(market.volatility.usdt * 100).toFixed(1)}%`,
      ``,
      `User Goal: ${goal}`,
      `Risk Tolerance: ${risk}`,
    ].join("\n");
  }

  private _parseStrategy(raw: string): Strategy {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`Failed to parse strategy JSON: ${raw}`);
    }

    // Convert numeric estimatedGas values to bigint (GPT cannot emit bigint).
    const actions: Action[] = ((parsed.actions as Action[]) ?? []).map((a) => ({
      ...a,
      estimatedGas: BigInt(String(a.estimatedGas ?? 0)),
    }));

    return {
      name: String(parsed.name ?? ""),
      description: String(parsed.description ?? ""),
      targetAllocation: (parsed.targetAllocation as Allocation) ?? {
        pancakeLP: 0,
        venusLending: 0,
        bnbStaking: 0,
        idle: 100,
      },
      expectedAPR: Number(parsed.expectedAPR ?? 0),
      riskLevel: (parsed.riskLevel as Strategy["riskLevel"]) ?? "low",
      actions,
      reasoning: String(parsed.reasoning ?? ""),
    };
  }

  /**
   * Encodes a single action into hex calldata for the StrategyExecutor.
   * Extend this mapping as new action types are added.
   */
  private _encodeAction(action: Action): string {
    const iface = new ethers.Interface([
      "function swapTokens(address,address,uint256,uint256) returns (uint256)",
      "function addLiquidity(address,address,uint256,uint256,int24,int24,uint256,uint256) returns (uint256)",
      "function supplyToVenus(address,uint256) returns (uint256)",
      "function stakeBNB(uint256,address) returns (bool)",
    ]);

    const p = action.params as Record<string, unknown>;

    switch (action.type) {
      case "swap":
        return iface.encodeFunctionData("swapTokens", [
          p.tokenIn,
          p.tokenOut,
          p.amountIn,
          p.minAmountOut ?? 0,
        ]);
      case "addLP":
        return iface.encodeFunctionData("addLiquidity", [
          p.token0,
          p.token1,
          p.amount0,
          p.amount1,
          p.tickLower ?? 0,
          p.tickUpper ?? 0,
          p.amount0Min ?? 0,
          p.amount1Min ?? 0,
        ]);
      case "supply":
        return iface.encodeFunctionData("supplyToVenus", [p.token, p.amount]);
      case "stake":
        return iface.encodeFunctionData("stakeBNB", [p.amount, p.validator]);
      default:
        throw new Error(`Unknown action type: ${(action as Action).type}`);
    }
  }
}
