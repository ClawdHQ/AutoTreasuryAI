# Security Policy

## Overview

AutoTreasury AI handles sensitive treasury funds and private keys. Security is our top priority.

## Environment Variables

### ⚠️ Never Commit Secrets

- **NEVER** commit `.env` files to git
- **ALWAYS** use `.env.example` as a template only
- **NEVER** include actual private keys or API keys in code

### Required Secrets

1. **PRIVATE_KEY** - Your BNB wallet private key
   - Keep this absolutely secure
   - Use a dedicated wallet for development
   - Never reuse production keys in development

2. **OPENAI_API_KEY** - Your OpenAI API key
   - Protect this key - it has billing implications
   - Use environment-specific keys
   - Rotate keys regularly

3. **DATABASE_URL** - Database connection string
   - Use strong passwords
   - Restrict network access
   - Enable SSL/TLS for connections

### Security Checklist

- [ ] `.env` is listed in `.gitignore`
- [ ] No hardcoded credentials in source code
- [ ] Test wallets only contain test tokens
- [ ] API keys have appropriate rate limits
- [ ] Database uses strong authentication

## Smart Contract Security

### Development Phase

1. **Use Test Networks**
   - Always test on BSC testnet first
   - Use test BNB from faucets
   - Never test with real funds

2. **Code Quality**
   - Follow Solidity best practices
   - Use latest stable compiler version
   - Enable all compiler warnings

3. **Testing**
   - Write comprehensive unit tests
   - Test edge cases and failure scenarios
   - Use fuzzing for critical functions

### Pre-Deployment

- [ ] Complete security audit
- [ ] All tests passing
- [ ] Gas optimization review
- [ ] Access control verification
- [ ] Reentrancy protection verified
- [ ] Integer overflow protection
- [ ] External call safety checked

## API Security

### Backend Protection

1. **Authentication**
   - Implement proper API authentication
   - Use JWT or similar tokens
   - Rotate secrets regularly

2. **Rate Limiting**
   - Prevent API abuse
   - Implement per-user limits
   - Monitor for suspicious activity

3. **Input Validation**
   - Validate all user inputs
   - Sanitize data before processing
   - Prevent injection attacks

### Frontend Security

1. **Wallet Connection**
   - Use WalletConnect or similar
   - Never request private keys
   - Clear sensitive data on disconnect

2. **Data Handling**
   - Validate addresses before transactions
   - Confirm all actions with users
   - Display transaction details clearly

## Dependency Security

### Package Management

1. **Regular Updates**
   ```bash
   pnpm audit
   pnpm update
   ```

2. **Audit Dependencies**
   - Review package.json regularly
   - Remove unused dependencies
   - Check for known vulnerabilities

3. **Lock Files**
   - Commit pnpm-lock.yaml
   - Review changes in lock files
   - Use exact versions for critical packages

## Incident Response

### If You Discover a Vulnerability

**DO NOT** open a public issue. Instead:

1. Email security contact (to be added)
2. Provide detailed description
3. Include steps to reproduce
4. Suggest a fix if possible

### Response Timeline

- **24 hours**: Initial acknowledgment
- **7 days**: Assessment and timeline
- **30 days**: Fix and disclosure (coordinated)

## Best Practices

### Development

- Use separate wallets for dev/test/prod
- Enable 2FA on all accounts
- Keep development machines secure
- Use VPN for sensitive operations

### Deployment

- Use hardware wallets for mainnet deployments
- Implement multi-sig for treasury contracts
- Test deployment scripts on testnet first
- Have rollback procedures ready

### Monitoring

- Monitor contract events
- Set up alerts for unusual activity
- Track gas prices for deployments
- Log all API access

## Resources

- [Consensys Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [OpenZeppelin Security](https://docs.openzeppelin.com/contracts/4.x/api/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Updates

This security policy will be updated as the project evolves. Last updated: 2026-02-19

---

**Remember**: Security is everyone's responsibility. When in doubt, ask!
