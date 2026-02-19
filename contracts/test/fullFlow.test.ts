import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = any;

// =========================================================================
// AutoTreasury AI – Full Integration Test Suite
// =========================================================================

describe("AutoTreasury AI – Full Flow", function () {
  // Extend timeout for integration-style tests.
  this.timeout(60_000);

  let vault: AnyContract;
  let owner1: HardhatEthersSigner;
  let owner2: HardhatEthersSigner;
  let owner3: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const OWNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OWNER_ROLE"));
  const EXECUTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("EXECUTOR_ROLE"));
  const AI_AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AI_AGENT_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

  // Helper: deploy a fresh vault before each test.
  beforeEach(async () => {
    [owner1, owner2, owner3, stranger] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("TreasuryVault");
    vault = await Vault.deploy(
      [owner1.address, owner2.address, owner3.address],
      2 // 2-of-3 threshold
    );
  });

  // =========================================================================
  // 1. Treasury Setup
  // =========================================================================

  describe("Treasury Setup", () => {
    it("deploys with correct owner count", async () => {
      expect(await vault.ownerCount()).to.equal(3);
    });

    it("deploys with correct approval threshold", async () => {
      expect(await vault.approvalThreshold()).to.equal(2);
    });

    it("grants OWNER_ROLE to all provided owners", async () => {
      expect(await vault.hasRole(OWNER_ROLE, owner1.address)).to.be.true;
      expect(await vault.hasRole(OWNER_ROLE, owner2.address)).to.be.true;
      expect(await vault.hasRole(OWNER_ROLE, owner3.address)).to.be.true;
    });

    it("grants DEFAULT_ADMIN_ROLE to the first owner only", async () => {
      expect(await vault.hasRole(DEFAULT_ADMIN_ROLE, owner1.address)).to.be.true;
      expect(await vault.hasRole(DEFAULT_ADMIN_ROLE, owner2.address)).to.be.false;
    });

    it("rejects deployment with zero owners", async () => {
      const Vault = await ethers.getContractFactory("TreasuryVault");
      await expect(Vault.deploy([], 1)).to.be.reverted;
    });

    it("rejects deployment when threshold exceeds owner count", async () => {
      const Vault = await ethers.getContractFactory("TreasuryVault");
      await expect(
        Vault.deploy([owner1.address, owner2.address], 3)
      ).to.be.reverted;
    });

    it("rejects deployment with zero threshold", async () => {
      const Vault = await ethers.getContractFactory("TreasuryVault");
      await expect(Vault.deploy([owner1.address], 0)).to.be.reverted;
    });
  });

  // =========================================================================
  // 2. Deposits
  // =========================================================================

  describe("Deposits", () => {
    it("accepts native BNB via depositBNB()", async () => {
      const amount = ethers.parseEther("10");
      await vault.connect(owner1).depositBNB({ value: amount });
      expect(await vault.assetBalances(ethers.ZeroAddress)).to.equal(amount);
    });

    it("emits Deposit event on BNB deposit", async () => {
      const amount = ethers.parseEther("1");
      await expect(vault.connect(owner1).depositBNB({ value: amount }))
        .to.emit(vault, "Deposit")
        .withArgs(ethers.ZeroAddress, amount, owner1.address);
    });

    it("accepts BNB via receive() fallback", async () => {
      const amount = ethers.parseEther("5");
      await owner1.sendTransaction({ to: await vault.getAddress(), value: amount });
      expect(await vault.assetBalances(ethers.ZeroAddress)).to.equal(amount);
    });

    it("reverts depositBNB with zero value", async () => {
      await expect(vault.connect(owner1).depositBNB({ value: 0 })).to.be.reverted;
    });

    it("accumulates multiple deposits correctly", async () => {
      const amount = ethers.parseEther("2");
      await vault.connect(owner1).depositBNB({ value: amount });
      await vault.connect(owner2).depositBNB({ value: amount });
      expect(await vault.assetBalances(ethers.ZeroAddress)).to.equal(amount * 2n);
    });
  });

  // =========================================================================
  // 3. Asset Management
  // =========================================================================

  describe("Asset Management", () => {
    it("initialises with native BNB (address(0)) in supportedAssets", async () => {
      expect(await vault.supportedAssets(0)).to.equal(ethers.ZeroAddress);
    });

    it("allows owner to add a supported asset", async () => {
      const token = owner2.address; // placeholder address
      await vault.connect(owner1).addSupportedAsset(token);
      expect(await vault.supportedAssets(1)).to.equal(token);
    });

    it("prevents adding the same asset twice", async () => {
      const token = owner2.address;
      await vault.connect(owner1).addSupportedAsset(token);
      await vault.connect(owner1).addSupportedAsset(token); // should silently return
      // supportedAssets length should still be 2 (BNB + token once)
      await expect(vault.supportedAssets(2)).to.be.reverted;
    });

    it("returns correct getAllocation percentages after single BNB deposit", async () => {
      const amount = ethers.parseEther("10");
      await vault.connect(owner1).depositBNB({ value: amount });
      const items = await vault.getAllocation();
      expect(items[0].asset).to.equal(ethers.ZeroAddress);
      expect(items[0].amount).to.equal(amount);
      expect(items[0].percentage).to.equal(10_000n); // 100 % in basis points
    });

    it("getPortfolioValue placeholder returns 0", async () => {
      expect(await vault.getPortfolioValue()).to.equal(0n);
    });
  });

  // =========================================================================
  // 4. Strategy Approval
  // =========================================================================

  describe("Strategy Approval", () => {
    it("allows an owner to whitelist a strategy contract", async () => {
      const strategy = stranger.address;
      await vault.connect(owner1).approveStrategy(strategy);
      expect(await vault.approvedStrategies(strategy)).to.be.true;
    });

    it("emits StrategyApproved event", async () => {
      const strategy = stranger.address;
      await expect(vault.connect(owner1).approveStrategy(strategy))
        .to.emit(vault, "StrategyApproved")
        .withArgs(strategy);
    });

    it("non-owner cannot whitelist a strategy", async () => {
      await expect(
        vault.connect(stranger).approveStrategy(stranger.address)
      ).to.be.reverted;
    });
  });

  // =========================================================================
  // 5. Action Lifecycle – Propose, Approve, Execute
  // =========================================================================

  describe("Action Lifecycle", () => {
    let executorSigner: HardhatEthersSigner;

    beforeEach(async () => {
      // Grant EXECUTOR_ROLE to owner1 so they can propose actions.
      await vault
        .connect(owner1)
        .grantRole(EXECUTOR_ROLE, owner1.address);
      executorSigner = owner1;
    });

    it("allows executor to propose an action", async () => {
      const target = await vault.getAddress(); // self-call target (any address)
      const data = "0x";
      const tx = await vault
        .connect(executorSigner)
        .proposeAction(target, data, 0, 0 /* SwapTokens */);
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
    });

    it("emits ActionProposed event with correct type", async () => {
      const target = await vault.getAddress();
      await expect(
        vault.connect(executorSigner).proposeAction(target, "0x", 0, 0)
      ).to.emit(vault, "ActionProposed");
    });

    it("non-executor cannot propose an action", async () => {
      await expect(
        vault.connect(stranger).proposeAction(stranger.address, "0x", 0, 0)
      ).to.be.reverted;
    });

    it("collects approvals correctly", async () => {
      const target = await vault.getAddress();
      const tx = await vault
        .connect(executorSigner)
        .proposeAction(target, "0x", 0, 0);
      const receipt = await tx.wait();
      // Extract actionId from ActionProposed event.
      const event = receipt?.logs
        .map((l: { topics: readonly string[]; data: string }) => {
          try {
            return vault.interface.parseLog({ topics: [...l.topics], data: l.data });
          } catch {
            return null;
          }
        })
        .find((e: ReturnType<typeof vault.interface.parseLog> | null) => e?.name === "ActionProposed");
      const actionId = event!.args[0] as string;

      await vault.connect(owner1).approveAction(actionId);
      const action = await vault.pendingActions(actionId);
      expect(action.approvals).to.equal(1n);

      await vault.connect(owner2).approveAction(actionId);
      const action2 = await vault.pendingActions(actionId);
      expect(action2.approvals).to.equal(2n);
    });

    it("prevents double-approving by the same owner", async () => {
      const target = await vault.getAddress();
      const tx = await vault
        .connect(executorSigner)
        .proposeAction(target, "0x", 0, 0);
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((l: { topics: readonly string[]; data: string }) => {
          try {
            return vault.interface.parseLog({ topics: [...l.topics], data: l.data });
          } catch {
            return null;
          }
        })
        .find((e: ReturnType<typeof vault.interface.parseLog> | null) => e?.name === "ActionProposed");
      const actionId = event!.args[0] as string;

      await vault.connect(owner1).approveAction(actionId);
      await expect(vault.connect(owner1).approveAction(actionId)).to.be.reverted;
    });

    it("reverts execution when approvals below threshold", async () => {
      const target = await vault.getAddress();
      const tx = await vault
        .connect(executorSigner)
        .proposeAction(target, "0x", 0, 0);
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((l: { topics: readonly string[]; data: string }) => {
          try {
            return vault.interface.parseLog({ topics: [...l.topics], data: l.data });
          } catch {
            return null;
          }
        })
        .find((e: ReturnType<typeof vault.interface.parseLog> | null) => e?.name === "ActionProposed");
      const actionId = event!.args[0] as string;

      await vault.connect(owner1).approveAction(actionId); // only 1 approval; threshold is 2
      await expect(vault.executeAction(actionId)).to.be.reverted;
    });
  });

  // =========================================================================
  // 6. AI Agent Role
  // =========================================================================

  describe("AI Agent Role", () => {
    it("allows AI agent to propose actions after role grant", async () => {
      const aiAgent = stranger;
      await vault.connect(owner1).grantRole(AI_AGENT_ROLE, aiAgent.address);

      const target = await vault.getAddress();
      const tx = await vault
        .connect(aiAgent)
        .proposeAction(target, "0x", 0, 0);
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
    });

    it("AI agent without role cannot propose actions", async () => {
      await expect(
        vault.connect(stranger).proposeAction(stranger.address, "0x", 0, 0)
      ).to.be.reverted;
    });
  });

  // =========================================================================
  // 7. Pause Controls
  // =========================================================================

  describe("Pause Controls", () => {
    it("owner can pause the vault", async () => {
      await vault.connect(owner1).pause();
      await expect(
        vault.connect(owner1).depositBNB({ value: ethers.parseEther("1") })
      ).to.be.reverted;
    });

    it("owner can unpause the vault", async () => {
      await vault.connect(owner1).pause();
      await vault.connect(owner1).unpause();
      // Deposit should succeed after unpause.
      await expect(
        vault.connect(owner1).depositBNB({ value: ethers.parseEther("1") })
      ).to.not.be.reverted;
    });

    it("non-owner cannot pause the vault", async () => {
      await expect(vault.connect(stranger).pause()).to.be.reverted;
    });
  });

  // =========================================================================
  // 8. Emergency Withdrawal
  // =========================================================================

  describe("Emergency Withdrawal", () => {
    it("owner can withdraw native BNB in emergency", async () => {
      const depositAmount = ethers.parseEther("10");
      await vault.connect(owner1).depositBNB({ value: depositAmount });

      const balanceBefore = await ethers.provider.getBalance(owner2.address);
      await vault.connect(owner1).emergencyWithdraw(
        ethers.ZeroAddress,
        owner2.address,
        depositAmount
      );
      const balanceAfter = await ethers.provider.getBalance(owner2.address);
      expect(balanceAfter - balanceBefore).to.equal(depositAmount);
    });

    it("emits EmergencyWithdraw event", async () => {
      const amount = ethers.parseEther("1");
      await vault.connect(owner1).depositBNB({ value: amount });
      await expect(
        vault.connect(owner1).emergencyWithdraw(
          ethers.ZeroAddress,
          owner2.address,
          amount
        )
      )
        .to.emit(vault, "EmergencyWithdraw")
        .withArgs(ethers.ZeroAddress, owner2.address, amount);
    });

    it("reverts emergency withdrawal for insufficient balance", async () => {
      await expect(
        vault.connect(owner1).emergencyWithdraw(
          ethers.ZeroAddress,
          owner2.address,
          ethers.parseEther("1")
        )
      ).to.be.reverted;
    });

    it("non-owner cannot call emergencyWithdraw", async () => {
      await vault.connect(owner1).depositBNB({ value: ethers.parseEther("1") });
      await expect(
        vault
          .connect(stranger)
          .emergencyWithdraw(
            ethers.ZeroAddress,
            stranger.address,
            ethers.parseEther("1")
          )
      ).to.be.reverted;
    });
  });

  // =========================================================================
  // 9. Time-Lock for Large Transactions
  // =========================================================================

  describe("Time-Lock (Large Transactions)", () => {
    it("applies 24-hour time-lock for large BNB transfers", async () => {
      const depositAmount = ethers.parseEther("100");
      await vault.connect(owner1).depositBNB({ value: depositAmount });

      // Approve strategy target.
      await vault.connect(owner1).approveStrategy(owner3.address);
      await vault.connect(owner1).grantRole(EXECUTOR_ROLE, owner1.address);

      // Propose a large transaction (>10% of vault balance).
      const largeValue = ethers.parseEther("20"); // 20% of 100 BNB
      const tx = await vault
        .connect(owner1)
        .proposeAction(owner3.address, "0x", largeValue, 0);
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((l: { topics: readonly string[]; data: string }) => {
          try {
            return vault.interface.parseLog({ topics: [...l.topics], data: l.data });
          } catch {
            return null;
          }
        })
        .find((e: ReturnType<typeof vault.interface.parseLog> | null) => e?.name === "ActionProposed");
      const actionId = event!.args[0] as string;

      await vault.connect(owner1).approveAction(actionId);
      await vault.connect(owner2).approveAction(actionId);

      // Should be time-locked even with sufficient approvals.
      await expect(vault.executeAction(actionId)).to.be.reverted;
    });
  });

  // =========================================================================
  // 10. Allocation Reads
  // =========================================================================

  describe("Allocation Reads", () => {
    it("returns zero percentage when vault is empty", async () => {
      const items = await vault.getAllocation();
      expect(items[0].percentage).to.equal(0n);
    });

    it("returns 100% for sole asset after deposit", async () => {
      await vault.connect(owner1).depositBNB({ value: ethers.parseEther("50") });
      const items = await vault.getAllocation();
      expect(items[0].percentage).to.equal(10_000n);
    });

    it("splits allocation correctly across two assets", async () => {
      const bnbAmount = ethers.parseEther("60");
      const tokenAddress = owner3.address; // dummy token address
      await vault.connect(owner1).addSupportedAsset(tokenAddress);
      await vault.connect(owner1).depositBNB({ value: bnbAmount });

      // Manually credit the second asset balance via emergencyWithdraw reverting
      // (we can't deposit ERC-20 without a real token; verify math only for BNB).
      const items = await vault.getAllocation();
      // BNB is 100 % of the vault (only BNB deposited).
      expect(items[0].percentage).to.equal(10_000n);
      // Second asset has 0 balance → 0 % allocation.
      expect(items[1].percentage).to.equal(0n);
    });
  });
});
