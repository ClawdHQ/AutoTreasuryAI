# AutoTreasury AI - Documentation

## Project Overview

AutoTreasury AI is an autonomous treasury management agent for DAOs and teams on BNB Chain. It uses AI to optimize fund allocation across PancakeSwap LP, Venus Protocol, and BNB staking based on risk tolerance and market conditions.

**Positioning:** "ChatGPT for your DAO treasury - just tell it what you want, it executes onchain"

## Architecture

This is a monorepo managed with pnpm workspaces, containing:

### 1. Contracts (`/contracts`)
Smart contracts deployed on BNB Chain:
- Core treasury management logic
- Protocol integrations (PancakeSwap V3, Venus)
- Access control and security features

### 2. AI Engine (`/ai-engine`)
AI-powered decision making:
- Natural language processing for user instructions
- Strategy selection and optimization
- Risk assessment models
- Portfolio rebalancing logic

### 3. Backend (`/backend`)
API and services:
- REST/GraphQL API
- Blockchain interaction services
- Database for tracking treasury state
- WebSocket for real-time updates

### 4. Frontend (`/frontend`)
Next.js web application:
- User-friendly dashboard
- Natural language chat interface
- Portfolio visualization
- Transaction history and analytics

## Tech Stack

- **Smart Contracts:** Solidity, Hardhat
- **AI:** OpenAI GPT-4, TypeScript
- **Backend:** Node.js, TypeScript
- **Frontend:** Next.js, React, TypeScript
- **Blockchain:** BNB Chain, ethers.js
- **Protocols:** PancakeSwap V3, Venus Protocol

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- BNB testnet account with test BNB
- OpenAI API key (GPT-4 access)

### Installation

```bash
# Clone the repository
git clone https://github.com/ClawdHQ/AutoTreasuryAI.git
cd AutoTreasuryAI

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your actual keys
```

### Development

```bash
# Run all workspaces in development mode
pnpm dev

# Build all workspaces
pnpm build

# Run tests
pnpm test
```

### Deployment

```bash
# Deploy contracts to BSC testnet
pnpm deploy:testnet
```

## Configuration

See `.env.example` for required environment variables:
- Network RPC endpoints
- Private keys
- API keys (OpenAI)
- Protocol addresses
- Database connection

## Project Structure

```
autotreasury-ai/
├── contracts/          # Smart contracts
│   ├── core/          # Core treasury contracts
│   ├── interfaces/    # Protocol interfaces
│   ├── libraries/     # Shared libraries
│   └── mocks/         # Test mocks
├── ai-engine/         # AI decision engine
│   ├── agents/        # AI agents
│   ├── strategies/    # Strategy implementations
│   └── risk-models/   # Risk assessment
├── backend/           # API and services
│   ├── api/           # API endpoints
│   ├── services/      # Business logic
│   └── db/            # Database
├── frontend/          # Web application
│   ├── components/    # React components
│   ├── pages/         # Next.js pages
│   ├── lib/           # Utilities
│   └── hooks/         # Custom hooks
├── scripts/           # Automation scripts
│   ├── deploy/        # Deployment scripts
│   ├── simulate/      # Simulation tools
│   └── analyze/       # Analysis tools
└── test/              # Tests
    ├── unit/          # Unit tests
    ├── integration/   # Integration tests
    └── e2e/           # End-to-end tests
```

## Development Timeline

- **Phase 1 (Days 1-2):** Project scaffolding and smart contract development
- **Phase 2 (Days 3-4):** AI engine and strategy implementation
- **Phase 3 (Days 5-6):** Backend API and frontend development
- **Phase 4 (Days 7-10):** Integration, testing, and deployment

## Contributing

This project is part of the BNB Chain AI Innovation Challenge. For contribution guidelines, please see CONTRIBUTING.md.

## License

MIT License - see LICENSE file for details.
