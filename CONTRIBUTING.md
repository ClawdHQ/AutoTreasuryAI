# Contributing to AutoTreasury AI

Thank you for your interest in contributing to AutoTreasury AI! This document provides guidelines and information for contributors.

## Getting Started

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/AutoTreasuryAI.git
   cd AutoTreasuryAI
   ```

2. **Set up development environment**
   ```bash
   # Install pnpm if needed
   curl -fsSL https://get.pnpm.io/install.sh | sh -
   
   # Install dependencies
   pnpm install
   
   # Copy environment template
   cp .env.example .env
   # Edit .env with your keys
   ```

3. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Making Changes

1. **Keep changes focused**: Each PR should address one feature or bug
2. **Follow existing patterns**: Match the code style of the workspace you're working in
3. **Write tests**: Add tests for new features and bug fixes
4. **Update documentation**: Keep README files and docs up to date

### Workspace-Specific Guidelines

#### Smart Contracts (`/contracts`)
- Follow Solidity best practices
- Add NatSpec comments for all public functions
- Write comprehensive tests
- Run `pnpm compile` and `pnpm test` before committing

#### AI Engine (`/ai-engine`)
- Use TypeScript strictly (no `any` types)
- Document AI model prompts and strategies
- Test with different scenarios
- Consider token limits and API costs

#### Backend (`/backend`)
- Follow RESTful API conventions
- Add API documentation
- Handle errors gracefully
- Include integration tests

#### Frontend (`/frontend`)
- Use Next.js best practices
- Keep components small and focused
- Ensure responsive design
- Test on different browsers

### Code Quality

#### TypeScript/JavaScript
```typescript
// ✅ Good
interface TreasuryConfig {
  riskTolerance: 'low' | 'medium' | 'high';
  protocols: string[];
}

// ❌ Bad
const config: any = {
  risk: 'medium'
};
```

#### Solidity
```solidity
// ✅ Good
/// @notice Deposits funds into the treasury
/// @param amount The amount to deposit in wei
/// @return success Whether the deposit succeeded
function deposit(uint256 amount) external returns (bool success) {
    // Implementation
}

// ❌ Bad
function deposit(uint256 a) external {
    // No documentation, unclear parameter name
}
```

### Testing

Run tests before committing:

```bash
# Test all workspaces
pnpm test

# Test specific workspace
cd contracts && pnpm test
cd ai-engine && pnpm test
cd backend && pnpm test
cd frontend && pnpm test
```

### Commits

Follow conventional commits:

```bash
# Format: type(scope): description

# Examples:
git commit -m "feat(contracts): add Venus Protocol integration"
git commit -m "fix(ai-engine): correct risk calculation logic"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(backend): add API endpoint tests"
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `style`: Code style changes
- `chore`: Maintenance tasks

## Pull Request Process

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**
   ```bash
   pnpm build    # Ensure builds succeed
   pnpm test     # Ensure tests pass
   pnpm lint     # Fix any linting issues (when available)
   ```

3. **Create Pull Request**
   - Write a clear title and description
   - Link related issues
   - Add screenshots for UI changes
   - Request review from maintainers

4. **Address feedback**
   - Respond to review comments
   - Make requested changes
   - Push updates to your branch

### PR Checklist

- [ ] Code follows project style
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] No console.log or debug code
- [ ] Commits follow conventional format
- [ ] Branch is up to date with main
- [ ] Security considerations addressed

## Code Review

### For Reviewers

- Be respectful and constructive
- Focus on code quality and security
- Test the changes locally
- Approve only when confident

### For Authors

- Be open to feedback
- Ask questions if unclear
- Explain your approach
- Update based on feedback

## Reporting Issues

### Bug Reports

Include:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Error messages/logs

### Feature Requests

Include:
- Use case and motivation
- Proposed solution
- Alternatives considered
- Impact on existing features

## Security

**IMPORTANT**: Never post security vulnerabilities publicly.

See [SECURITY.md](./SECURITY.md) for reporting security issues.

## Community Guidelines

### Be Respectful
- Welcome newcomers
- Be patient and helpful
- Assume good intentions
- Keep discussions professional

### Be Collaborative
- Share knowledge
- Help others learn
- Contribute to discussions
- Review others' PRs

### Be Responsible
- Test your changes
- Don't break existing features
- Follow security practices
- Write maintainable code

## Getting Help

- 📖 Check the [documentation](./docs/README.md)
- 💬 Open a discussion on GitHub
- 🐛 Search existing issues
- ❓ Ask in PR/issue comments

## Development Tips

### Useful Commands

```bash
# Development
pnpm dev              # Run all workspaces
pnpm -r dev           # Run each workspace dev script

# Building
pnpm build            # Build all workspaces
pnpm -r build         # Build each workspace

# Testing
pnpm test             # Test all workspaces
pnpm -r test          # Test each workspace

# Cleanup
pnpm clean            # Clean build artifacts (when available)
rm -rf node_modules   # Remove all dependencies
pnpm install          # Reinstall
```

### IDE Setup

Recommended VS Code extensions:
- Solidity (Juan Blanco)
- ESLint
- Prettier
- TypeScript
- GitLens

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Don't hesitate to ask! Open an issue or discussion if you need help.

---

Thank you for contributing to AutoTreasury AI! 🚀
