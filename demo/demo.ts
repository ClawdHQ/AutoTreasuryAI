import chalk from "chalk";
import crypto from "crypto";

// =========================================================================
// Helpers
// =========================================================================

/** Pause execution for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Generate a realistic-looking 32-byte transaction hash (simulated – not a real BSC transaction). */
function randomHash(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Print a horizontal divider. */
function divider(): void {
  console.log(chalk.gray("─".repeat(60)));
}

// =========================================================================
// Demo Sections
// =========================================================================

async function showHook(): Promise<void> {
  console.log(chalk.bold.cyan("\n[0:00–0:30] 🎣  HOOK\n"));
  console.log(chalk.white("Managing a DAO treasury is hard."));
  await sleep(1000);
  console.log(
    chalk.white("Choosing between PancakeSwap LP, Venus lending, BNB staking...")
  );
  await sleep(1000);
  console.log(
    chalk.white("Optimising for APR, managing risk, rebalancing constantly...")
  );
  await sleep(1000);
  console.log(chalk.bold.yellow('\n💡 What if AI did it all for you?\n'));
  await sleep(1500);
}

async function showProblem(): Promise<void> {
  divider();
  console.log(chalk.bold.cyan("\n[0:30–1:00] ⚠️   PROBLEM\n"));

  console.log(chalk.yellow("Current treasury state (unoptimised):"));
  console.log("");
  console.log(
    chalk.white("  Protocol         Allocation   APR     Notes")
  );
  console.log(
    chalk.gray(
      "  ─────────────────────────────────────────────────────"
    )
  );
  console.log(chalk.red("  Idle wallet       100 %       0.0 %   doing nothing"));
  console.log(
    chalk.gray(
      "  ─────────────────────────────────────────────────────"
    )
  );
  console.log(chalk.white("\n  Total Value: $50,000"));
  console.log(chalk.red("  Current APR:  0.0 %  ← money sleeping! 😴\n"));

  await sleep(2000);

  console.log(chalk.yellow("The manual approach:"));
  console.log(chalk.white("  • Research 5+ protocols for current APRs"));
  console.log(chalk.white("  • Calculate optimal split by hand"));
  console.log(chalk.white("  • Execute 4–6 transactions manually"));
  console.log(chalk.white("  • Pay gas for every rebalance (~$15–$30)"));
  console.log(chalk.white("  • Repeat weekly  ⏰  Time cost: 2–3 h/week\n"));

  await sleep(1500);
}

async function showSolution(): Promise<void> {
  divider();
  console.log(chalk.bold.cyan("\n[1:00–2:00] 🤖  SOLUTION – AUTOTREASURY AI\n"));

  // User types a command
  await sleep(500);
  console.log(chalk.bold.green('You: "Optimize my treasury for moderate risk"\n'));
  await sleep(1000);

  // AI thinking animation
  process.stdout.write(chalk.blue("🤖 AI: Analysing "));
  for (let i = 0; i < 6; i++) {
    await sleep(400);
    process.stdout.write(chalk.blue("."));
  }
  console.log("\n");

  await sleep(500);

  // AI full analysis response
  console.log(
    chalk.blue('🤖 AI: I recommend the "Balanced Growth" strategy:\n')
  );

  console.log(chalk.white("  📊 Market APRs right now:"));
  console.log(chalk.white("       PancakeSwap BNB-USDT LP  →  18.4 %"));
  console.log(chalk.white("       Venus USDT lending       →   6.2 %"));
  console.log(chalk.white("       BNB Staking              →   5.1 %\n"));

  console.log(chalk.white("  🎯 Target Allocation:"));
  console.log(chalk.green("       40 %  PancakeSwap LP  (BNB-USDT)"));
  console.log(chalk.cyan("       35 %  Venus Lending   (USDT)"));
  console.log(chalk.yellow("       20 %  BNB Staking"));
  console.log(chalk.gray("        5 %  Idle            (for flexibility)\n"));

  console.log(chalk.bold.green("  ✨ Expected APR : 12.5 %  (+12.5 % vs now)"));
  console.log(chalk.white("  🛡️  Risk Level   : Medium (score 45/100)\n"));

  await sleep(2000);

  // Execute strategy
  console.log(chalk.bold.yellow('▶  Clicking "Execute Strategy"...\n'));
  await sleep(1000);

  console.log(chalk.white("  3 actions queued:\n"));

  const actions: Array<{ label: string; txNote: string }> = [
    {
      label: "Swapping 20,000 USDT → BNB on PancakeSwap",
      txNote: "Swap",
    },
    {
      label: "Adding liquidity: 10 BNB + 6,000 USDT to PancakeSwap V3",
      txNote: "AddLP",
    },
    {
      label: "Supplying 17,500 USDT to Venus Protocol",
      txNote: "Supply",
    },
    {
      label: "Staking 10 BNB with Validator",
      txNote: "Stake",
    },
  ];

  for (const action of actions) {
    console.log(chalk.yellow(`  ⚡ ${action.label}...`));
    await sleep(2000);
    const txHash = randomHash();
    console.log(chalk.green(`     ✅ Confirmed!`));
    console.log(
      chalk.gray(
        `        TX:      0x${txHash}`
      )
    );
    console.log(
      chalk.cyan(
        `        BSCScan: https://testnet.bscscan.com/tx/0x${txHash}\n`
      )
    );
  }

  // Final state
  console.log(chalk.bold.blue("✨ Strategy Executed Successfully!\n"));
  console.log(chalk.white("  New Allocation:"));
  console.log(chalk.green("    PancakeSwap LP  : 40 %"));
  console.log(chalk.cyan("    Venus Lending   : 35 %"));
  console.log(chalk.yellow("    BNB Staking     : 20 %"));
  console.log(chalk.gray("    Idle            :  5 %\n"));
  console.log(chalk.bold.green("  New APR       : 12.5 %  🚀"));
  console.log(chalk.white("  Risk Score    : 45/100 (Medium)\n"));

  await sleep(1500);
}

async function showFeatures(): Promise<void> {
  divider();
  console.log(chalk.bold.cyan("\n[2:00–2:30] 🌟  KEY FEATURES\n"));

  const features: Array<[string, string]> = [
    ["💬", "Natural language interface   – no DeFi expertise needed"],
    ["🧠", "AI-powered optimisation      – GPT-4 analyses & proposes"],
    ["🔗", "Multi-protocol integration   – PancakeSwap V3 + Venus + BNB Staking"],
    ["🛡️", "Risk-adjusted strategies     – low / medium / high profiles"],
    ["⚡", "One-click execution          – multi-sig approval + on-chain execution"],
    ["📈", "Real-time monitoring         – live dashboard with performance data"],
  ];

  for (const [icon, text] of features) {
    console.log(chalk.white(`  ${icon}  ${text}`));
    await sleep(400);
  }

  console.log("");
  await sleep(1000);
}

async function showCTA(): Promise<void> {
  divider();
  console.log(chalk.bold.cyan("\n[2:30–3:00] 🎯  CALL TO ACTION\n"));

  console.log(
    chalk.bold.yellow(
      '  🤖 AutoTreasury AI: "ChatGPT for your DAO treasury"\n'
    )
  );
  console.log(chalk.white("  🏗️  Built on BNB Chain"));
  console.log(chalk.white("  🏆  Good Vibes Only: OpenClaw Edition\n"));

  console.log(chalk.bold.green("  Try it now:"));
  console.log(chalk.cyan("    1. Connect wallet"));
  console.log(chalk.cyan('    2. Chat: "Optimize for high APR"'));
  console.log(chalk.cyan("    3. AI proposes strategy"));
  console.log(chalk.cyan("    4. Click Execute"));
  console.log(chalk.cyan("    5. Watch live transactions on BSCScan\n"));

  console.log(
    chalk.bold.magenta(
      "  🔗 https://autotreasury.vercel.app\n"
    )
  );

  divider();
  console.log(
    chalk.bold.green(
      "\n🎉 AutoTreasury AI – Because your DAO deserves the best treasury management!\n"
    )
  );
}

// =========================================================================
// Entry Point
// =========================================================================

async function runDemo(): Promise<void> {
  console.clear();

  console.log(
    chalk.bold.blue(
      "╔══════════════════════════════════════════════════════════╗\n" +
      "║          🤖  AutoTreasury AI  –  Live Demo  💰           ║\n" +
      "╚══════════════════════════════════════════════════════════╝"
    )
  );

  await sleep(1000);

  await showHook();
  await showProblem();
  await showSolution();
  await showFeatures();
  await showCTA();
}

runDemo().catch((err: unknown) => {
  console.error(chalk.red("Demo failed:"), err);
  process.exit(1);
});
