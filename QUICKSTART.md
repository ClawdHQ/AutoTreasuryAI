# Quick Start Guide

Welcome to AutoTreasury AI! This guide will help you get the project up and running.

## Prerequisites

Before you begin, ensure you have:

- ✅ Node.js 20 or higher installed
- ✅ pnpm package manager installed
- ✅ Git installed
- ✅ BNB testnet account (for blockchain testing)
- ✅ OpenAI API key with GPT-4 access

## Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/ClawdHQ/AutoTreasuryAI.git
cd AutoTreasuryAI

# Install pnpm if not already installed
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc

# Verify installation
node --version  # Should be 20+
pnpm --version
```

## Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your actual values
nano .env  # or use your preferred editor
```

Required environment variables:
- `PRIVATE_KEY` - Your BNB testnet private key
- `OPENAI_API_KEY` - Your OpenAI API key (starts with sk-)
- `BSC_TESTNET_RPC` - BNB testnet RPC URL (default provided)

## Step 3: Install Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

This will install dependencies for:
- Smart contracts workspace
- AI engine workspace
- Backend workspace
- Frontend workspace

## Step 4: Development

You can run each workspace individually or all together:

### Run all workspaces in parallel
```bash
pnpm dev
```

### Run individual workspaces
```bash
# Smart contracts
cd contracts
pnpm dev

# AI engine
cd ai-engine
pnpm dev

# Backend
cd backend
pnpm dev

# Frontend
cd frontend
pnpm dev
```

## Step 5: Deploy Smart Contracts (Optional)

To deploy contracts to BNB testnet:

```bash
# Ensure you have test BNB in your wallet
# Get testnet BNB from: https://testnet.binance.org/faucet-smart

# Deploy contracts
pnpm deploy:testnet
```

## Project Structure Overview

```
AutoTreasuryAI/
├── contracts/      → Smart contracts (Solidity + Hardhat)
├── ai-engine/      → AI decision making engine
├── backend/        → API and blockchain services
├── frontend/       → Next.js web application
├── scripts/        → Automation and deployment scripts
├── test/           → Test suites
└── docs/           → Documentation
```

## Next Steps

1. **Read the Documentation**: Check out `/docs/README.md` for detailed architecture
2. **Explore Contracts**: Start with `/contracts/README.md` to understand smart contract structure
3. **Try the AI Engine**: See `/ai-engine/README.md` for AI strategy details
4. **Build Frontend**: Check `/frontend/README.md` for UI development

## Common Commands

```bash
# Development (all workspaces)
pnpm dev

# Build all workspaces
pnpm build

# Run tests
pnpm test

# Deploy to testnet
pnpm deploy:testnet

# List all workspace packages
pnpm list -r --depth=-1
```

## Getting Help

- 📖 Full documentation: `/docs/README.md`
- 🔗 Issues: [GitHub Issues](https://github.com/ClawdHQ/AutoTreasuryAI/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/ClawdHQ/AutoTreasuryAI/discussions)

## Development Timeline

- **Days 1-2**: Smart contract development ✨
- **Days 3-4**: AI engine and strategies
- **Days 5-6**: Backend API and frontend
- **Days 7-10**: Integration and testing

Happy coding! 🚀
