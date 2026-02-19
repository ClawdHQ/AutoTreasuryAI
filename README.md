# AutoTreasury AI 🤖💰

> "ChatGPT for your DAO treasury - just tell it what you want, it executes onchain"

AutoTreasury AI is an autonomous treasury management agent for DAOs and teams on BNB Chain. It uses AI to optimize fund allocation across PancakeSwap LP, Venus Protocol, and BNB staking based on risk tolerance and market conditions.

## ✨ Features

- 🤖 **AI-Powered Decisions**: Natural language interface powered by GPT-4
- 💼 **Multi-Protocol Support**: PancakeSwap V3, Venus Protocol, BNB staking
- 📊 **Risk Management**: Customizable risk profiles and portfolio optimization
- 🔄 **Auto-Rebalancing**: Continuous optimization based on market conditions
- 🔒 **Security First**: Multi-sig support and comprehensive testing

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your keys

# Start development
pnpm dev
```

📖 See [QUICKSTART.md](./QUICKSTART.md) for detailed setup instructions.

## 📚 Documentation

- [Quick Start Guide](./QUICKSTART.md) - Get up and running in 5 minutes
- [Full Documentation](./docs/README.md) - Architecture and detailed guides
- [Smart Contracts](./contracts/README.md) - Contract documentation
- [AI Engine](./ai-engine/README.md) - AI strategy details
- [Backend API](./backend/README.md) - API documentation
- [Frontend](./frontend/README.md) - UI development guide

## 🏗️ Architecture

This is a monorepo with 4 main workspaces:

- **contracts** - Smart contracts (Solidity + Hardhat)
- **ai-engine** - AI decision making engine (TypeScript + OpenAI)
- **backend** - API and blockchain services (Node.js)
- **frontend** - Web application (Next.js + React)

## 🛠️ Tech Stack

- **Blockchain**: BNB Chain, Solidity, Hardhat, ethers.js
- **AI**: OpenAI GPT-4, TypeScript
- **Backend**: Node.js, TypeScript
- **Frontend**: Next.js, React, TailwindCSS
- **Protocols**: PancakeSwap V3, Venus Protocol

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Test individual workspaces
cd contracts && pnpm test
cd ai-engine && pnpm test
cd backend && pnpm test
cd frontend && pnpm test
```

## 🚢 Deployment

```bash
# Deploy to BNB testnet
pnpm deploy:testnet
```

## 📋 Development Timeline

- **Phase 1 (Days 1-2)**: Project scaffolding and smart contracts ✅
- **Phase 2 (Days 3-4)**: AI engine and strategy implementation
- **Phase 3 (Days 5-6)**: Backend API and frontend development
- **Phase 4 (Days 7-10)**: Integration, testing, and deployment

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🔗 Links

- [BNB Chain](https://www.bnbchain.org/)
- [PancakeSwap V3](https://pancakeswap.finance/)
- [Venus Protocol](https://venus.io/)

---

Built for the BNB Chain AI Innovation Challenge 🏆
