# Security Model & Threat Analysis

This document outlines the security model for Fund-My-Cause, including threat analysis, mitigation strategies, security checklists, and incident response procedures.

---

## 1. Security Model

### 1.1 Core Principles

Fund-My-Cause is built on three core security principles:

1. **Immutability**: Smart contracts deployed on Stellar are immutable. Once deployed, contract logic cannot be changed, ensuring predictable behavior and preventing backdoors.
2. **Pull-based Refunds**: Contributors claim refunds individually, preventing a single point of failure where a creator could block all refunds.
3. **On-chain Verification**: All critical operations (contributions, withdrawals, refunds) are enforced by the smart contract, not the frontend.

### 1.2 Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Stellar Network (Trusted)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Soroban Smart Contracts (Immutable, Audited)        │   │
│  │  - crowdfund contract                                │   │
│  │  - registry contract                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ (RPC calls)
                            │
┌─────────────────────────────────────────────────────────────┐
│              Frontend & User Devices (Untrusted)            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Next.js Interface (Convenience Layer)               │   │
│  │  - Campaign discovery                                │   │
│  │  - Transaction construction                          │   │
│  │  - User experience                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  User Wallets (Freighter, Lobstr, Hardware)          │   │
│  │  - Private key management                            │   │
│  │  - Transaction signing                               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key assumption**: The Stellar network and Soroban runtime are secure. Vulnerabilities in Stellar/Soroban core are out of scope and should be reported to [Stellar's bug bounty program](https://www.stellar.org/bug-bounty-program).

### 1.3 Backend Data Flows

### 1.3.1 Indexer Service

The indexer service streams on-chain events from the Soroban RPC endpoint, transforms them, and persists them to a PostgreSQL database. Data flows involve:

1. **RPC Stream**: Long-lived connection to Soroban RPC (`soroban-testnet.stellar.org`), receiving contract events (`initialize`, `contribute`, `withdraw`, `refund`)
2. **Event Ingestion**: Events parsed, validated, and written to `raw_events` table; campaigns/contributions/refunds materialized into relational tables
3. **REST API**: Exposes `/events`, `/stats`, `/health`, `/ready` endpoints for frontend and monitoring consumption
4. **GraphQL API (embedded)**: Provides `/graphql` endpoint with query complexity analysis for campaign data queries

### 1.3.2 GraphQL API Service

The GraphQL API acts as a caching and aggregation layer between the frontend and the Soroban blockchain:

1. **Soroban RPC Calls**: Fetches campaign and user data via JSON-RPC to Soroban nodes
2. **Redis Cache**: Caches resolved GraphQL queries (campaign lists, stats, user profiles) with TTL-based expiration
3. **WebSocket Subscriptions**: Real-time updates via `graphql-ws` for campaign status changes, new contributions, milestone events
4. **JWT Authentication**: Stateless token verification for authenticated mutations; signature-based wallet challenge
5. **Rate Limiting**: Token-bucket rate limits per IP and per authenticated user via Redis-backed rate-limiter-flexible

### 1.3.3 Data Flow Diagram

```
                  ┌──────────────────────────────────────────────────────┐
                  │                   Stellar Network                    │
                  │  ┌────────────────────────────────────────────────┐  │
                  │  │           Soroban Smart Contracts              │  │
                  │  │  (crowdfund, registry, achievements)           │  │
                  │  └────────────────────────────────────────────────┘  │
                  └──────────────────────┬───────────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │   Indexer Service │ │  GraphQL API      │ │  Monitoring       │
        │   (Express/REST)  │ │  (Apollo/WS/Redis)│ │  Service          │
        │                   │ │                   │ │                   │
        │ - Event streaming │ │ - Cached queries  │ │ - Health checks   │
        │ - DB persistence  │ │ - Subscriptions   │ │ - Alert routing   │
        │ - REST endpoints  │ │ - Auth (JWT)      │ │ - Metrics export  │
        └────────┬──────────┘ └────────┬──────────┘ └───────────────────┘
                 │                     │
                 ▼                     ▼
        ┌───────────────────┐ ┌───────────────────┐
        │   PostgreSQL DB   │ │   Redis Cache      │
        │ - raw_events      │ │ - campaign cache   │
        │ - campaigns       │ │ - rate limit state │
        │ - contributions   │ │ - session data     │
        │ - refunds         │ └───────────────────┘
        └───────────────────┘
                 ▲
                 │
        ┌───────────────────┐
        │  Next.js Frontend │
        │ - SSR pages       │
        │ - Client queries  │
        │ - Wallet connect  │
        └───────────────────┘
```

### 1.3.4 Threat Model Scope

**In Scope:**
- Smart contract logic (crowdfund, registry)
- Frontend application (Next.js interface)
- **Indexer service (event ingestion, REST/GraphQL API, database)**
- **GraphQL API service (caching, subscriptions, authentication, rate limiting)**
- **PostgreSQL database and Redis cache**
- CI/CD pipelines and deployment processes
- Wallet integration and transaction signing
- Data validation and input sanitization

**Out of Scope:**
- Stellar/Soroban core protocol vulnerabilities
- Network-level attacks (DDoS on Stellar infrastructure)
- User device compromise (malware, keyloggers)
- Social engineering attacks targeting end users

---

## 2. Threat Analysis

### 2.1 Smart Contract Threats

#### Threat: Reentrancy Attacks
**Severity**: High  
**Description**: A malicious contract could call back into the crowdfund contract during execution, potentially manipulating state.  
**Mitigation**:
- Soroban's contract model does not support traditional reentrancy due to its synchronous execution model.
- State changes are atomic within a single transaction.
- No external calls are made during state mutations.

#### Threat: Integer Overflow/Underflow
**Severity**: High  
**Description**: Arithmetic operations on token amounts could overflow, causing incorrect fund calculations.  
**Mitigation**:
- Rust's type system prevents overflow in debug mode and panics in release mode.
- All arithmetic uses checked operations (`checked_add`, `checked_sub`).
- Comprehensive unit tests verify edge cases (zero amounts, max values).

#### Threat: Unauthorized Fund Withdrawal
**Severity**: Critical  
**Description**: A non-creator could withdraw funds from a successful campaign.  
**Mitigation**:
- The `withdraw` function checks `msg.sender() == creator` before allowing withdrawal.
- Only the creator can call `withdraw`.
- Funds are transferred directly to the creator's address via Stellar's native token operations.

#### Threat: Incorrect Refund Calculation
**Severity**: High  
**Description**: Contributors could receive incorrect refund amounts due to calculation errors.  
**Mitigation**:
- Refund amount is stored per contributor at contribution time.
- `refund_single` returns exactly the amount contributed, with no deductions.
- Refunds are only available if the campaign goal is not met.

#### Threat: Deadline Manipulation
**Severity**: Medium  
**Description**: An attacker could manipulate the campaign deadline to extend or shorten the contribution window.  
**Mitigation**:
- Deadline is set at initialization and stored immutably.
- Deadline cannot be changed after initialization.
- Deadline is checked against Stellar's ledger timestamp, which is consensus-verified.

#### Threat: Platform Fee Theft
**Severity**: Medium  
**Description**: Platform fees could be redirected to an attacker's address.  
**Mitigation**:
- Platform address and fee percentage are set at initialization and immutable.
- Fees are calculated and transferred only during `withdraw`.
- Fee calculation uses integer division to prevent rounding exploits.

### 2.2 Frontend Threats

#### Threat: Phishing via Malicious Domain
**Severity**: High  
**Description**: An attacker could host a fake Fund-My-Cause interface to steal wallet credentials.  
**Mitigation**:
- Users should only access the official domain announced in the GitHub README.
- HTTPS is enforced; HTTP connections are rejected.
- Users should bookmark the official URL and never click links from unsolicited messages.
- See [Security Best Practices](./security-best-practices.md) for verification steps.

#### Threat: XSS (Cross-Site Scripting)
**Severity**: High  
**Description**: Malicious JavaScript could be injected into the frontend to steal wallet data or sign unauthorized transactions.  
**Mitigation**:
- Next.js automatically escapes JSX content.
- Content Security Policy (CSP) headers restrict script execution.
- User input is sanitized before display.
- No `dangerouslySetInnerHTML` is used without sanitization.
- Regular dependency audits via `npm audit` and GitHub Dependabot.

#### Threat: CSRF (Cross-Site Request Forgery)
**Severity**: Medium  
**Description**: An attacker could trick a user into signing a transaction on behalf of a malicious site.  
**Mitigation**:
- Wallet connections are explicit and require user approval.
- Transactions are constructed by the frontend and signed by the user's wallet.
- The wallet displays full transaction details before signing.
- No automatic transaction signing occurs.

#### Threat: Man-in-the-Middle (MITM) Attack
**Severity**: High  
**Description**: An attacker on the network could intercept and modify RPC calls or responses.  
**Mitigation**:
- All communication uses HTTPS with TLS 1.2+.
- RPC endpoints are verified via DNS and certificate pinning (where applicable).
- Users should verify contract addresses on Stellar Expert before contributing.

#### Threat: Malicious Contract Address Injection
**Severity**: High  
**Description**: The frontend could be compromised to display a different contract address, tricking users into interacting with a malicious contract.  
**Mitigation**:
- Contract addresses are stored in environment variables and verified at build time.
- Contract addresses are displayed prominently in the UI.
- Users should verify the contract address on Stellar Expert before contributing.
- The contract address is immutable once deployed.

### 2.3 Wallet Integration Threats

#### Threat: Wallet Extension Compromise
**Severity**: Critical  
**Description**: A malicious browser extension could intercept wallet operations or steal private keys.  
**Mitigation**:
- Users should install Freighter only from official sources (freighter.app or official browser stores).
- Users should review extension permissions and keep extensions updated.
- Hardware wallet support (Ledger) provides an additional layer of security.
- See [Security Best Practices](./security-best-practices.md) for wallet security guidance.

#### Threat: Unauthorized Transaction Signing
**Severity**: High  
**Description**: A compromised frontend could request the wallet to sign a malicious transaction.  
**Mitigation**:
- Wallets display full transaction details before signing.
- Users must explicitly approve each transaction.
- The wallet verifies the contract ID and operation type.
- Users should review every transaction before signing.

### 2.4 Deployment & Infrastructure Threats

#### Threat: Compromised CI/CD Pipeline
**Severity**: Critical  
**Description**: An attacker could compromise GitHub Actions to deploy malicious code or contracts.  
**Mitigation**:
- GitHub Actions workflows are version-pinned and reviewed.
- Secrets are stored in GitHub Secrets and never logged.
- Deployment workflows require manual approval for production.
- All deployments are audited and logged.

#### Threat: Unauthorized Contract Deployment
**Severity**: Critical  
**Description**: An attacker could deploy a malicious contract under the Fund-My-Cause name.  
**Mitigation**:
- Only authorized team members can deploy contracts.
- Deployments require GitHub Actions approval.
- Deployed contract IDs are published in release notes.
- Users should verify contract IDs on Stellar Expert.

#### Threat: Dependency Vulnerability
**Severity**: Medium to High  
**Description**: A compromised or vulnerable dependency could introduce security flaws.  
**Mitigation**:
- Dependencies are pinned to exact versions in `Cargo.lock` and `package-lock.json`.
- `npm audit` and `cargo audit` are run in CI/CD.
- Dependabot automatically creates PRs for security updates.
- Dependencies are reviewed before merging.

### 2.5 Data & Privacy Threats

#### Threat: Sensitive Data Exposure
**Severity**: Medium  
**Description**: Private keys, API keys, or other secrets could be exposed in logs or version control.  
**Mitigation**:
- Secrets are stored in GitHub Secrets, not in code.
- `.env` files are in `.gitignore`.
- Logs are sanitized to remove sensitive data.
- Pre-commit hooks prevent accidental secret commits.

#### Threat: Unauthorized Data Access
**Severity**: Low to Medium  
**Description**: An attacker could access campaign data or contributor information.  
**Mitigation**:
- All campaign data is public on-chain (by design).
- Contributor addresses are public (Stellar addresses are public).
- No private user data is stored off-chain.
- No authentication is required to view campaigns (intentional).

### 2.6 Backend Service Threats (STRIDE)

#### Spoofing

| Threat | Component | Severity | Mitigation |
|--------|-----------|----------|------------|
| RPC endpoint spoofing | Indexer, GraphQL API | High | RPC URL configured via environment variable; pinned at deployment; TLS certificate verification on outbound connections |
| JWT token forgery | GraphQL API | High | Token signed with server-side secret; short-lived tokens (1h); signature verification on every request |
| Database connection spoofing | Indexer | High | PostgreSQL connection uses SSL/TLS; `pg_hba.conf` restricted to service IPs; credentials from secrets manager |
| Redis connection spoofing | GraphQL API | Medium | Redis bound to localhost in single-deployment; AUTH password required in production |

#### Tampering

| Threat | Component | Severity | Mitigation |
|--------|-----------|----------|------------|
| Event data manipulation in transit | Indexer | Medium | Events sourced directly from Soroban RPC (TLS); replayed against on-chain state for verification |
| Cache poisoning via crafted queries | GraphQL API | Medium | Query complexity limits; depth limits on GraphQL; cache keys include full query+variables |
| GraphQL query injection | GraphQL API | High | Input validation on all arguments; parameterized queries to PostgreSQL; no raw string interpolation in resolvers |

#### Repudiation

| Threat | Component | Severity | Mitigation |
|--------|-----------|----------|------------|
| Missing audit trail for API mutations | GraphQL API | Medium | All mutations logged with timestamp, user address, and payload hash; logs shipped to centralized logging (ELK) |
| No event processing accountability | Indexer | Medium | Raw events persisted with idempotency keys (`tx_hash + event_type`); processing status tracked per event |

#### Information Disclosure

| Threat | Component | Severity | Mitigation |
|--------|-----------|----------|------------|
| GraphQL introspection enabled in production | GraphQL API | Medium | Introspection disabled when `NODE_ENV=production`; schema not exposed to untrusted clients |
| Verbose error messages leaking internals | Indexer, GraphQL API | Medium | Production error responses return generic messages; stack traces logged server-side only |
| Database schema enumeration via API | Indexer | Medium | REST API returns only whitelisted fields; no raw SQL exposure; ORM-style query construction |

#### Denial of Service

| Threat | Component | Severity | Mitigation |
|--------|-----------|----------|------------|
| RPC request flooding | Indexer | High | Fixed polling interval with backpressure; bounded event queue; circuit breaker on RPC connection |
| GraphQL query depth/complexity attacks | GraphQL API | High | Query complexity scoring; depth limit (max 7 levels); rate limiting per IP and per user token |
| Cache stampede | GraphQL API | Medium | Revalidating cache with jittered TTL; stale-while-revalidate pattern; Redis connection pooling |
| Database connection exhaustion | Indexer | High | Connection pool with maximum limit (20); query timeout (30s); health check drains pool on startup |

#### Elevation of Privilege

| Threat | Component | Severity | Mitigation |
|--------|-----------|----------|------------|
| Unauthenticated mutation access | GraphQL API | Critical | All mutations require valid JWT; wallet address in token must match mutation parameters; no admin bypass |
| Database superuser access via service | Indexer | Critical | Database user has least-privilege grants (SELECT/INSERT on app tables only); no DDL permissions at runtime |
| Redis command injection | GraphQL API | Medium | Redis commands parameterized via ioredis; `rename-command` for dangerous commands in redis.conf |

---

## 3. Mitigation Strategies

### 3.1 Smart Contract Security

| Threat | Mitigation | Verification |
|--------|-----------|--------------|
| Logic errors | Comprehensive unit tests, formal verification | `cargo test --workspace` |
| Integer overflow | Checked arithmetic, type system | Rust compiler, tests |
| Unauthorized access | Role-based checks, immutable state | Code review, tests |
| Reentrancy | Synchronous execution model | Soroban design |
| Gas exhaustion | Gas limits per operation | Stellar network limits |

### 3.2 Frontend Security

| Threat | Mitigation | Verification |
|--------|-----------|--------------|
| XSS | Content Security Policy, input sanitization | ESLint, security headers |
| CSRF | Explicit wallet connection, user approval | Manual testing |
| MITM | HTTPS, certificate verification | TLS 1.2+ |
| Phishing | User education, URL verification | Documentation |
| Malicious injection | Environment variables, code review | Build-time verification |

### 3.3 Wallet Integration Security

| Threat | Mitigation | Verification |
|--------|-----------|--------------|
| Extension compromise | Official sources only, user education | User responsibility |
| Unauthorized signing | Wallet approval, transaction display | Wallet design |
| Private key theft | Hardware wallet support, user education | User responsibility |

### 3.4 Backend Service Security

| Threat | Mitigation | Verification |
|--------|-----------|--------------|
| RPC spoofing | HTTPS/TLS, env-pinned URLs | Deployment review, network policy |
| JWT forgery | Strong secret, short expiry, signature check | Auth tests, secret rotation |
| Cache poisoning | Full-query cache keys, TTL limits | Cache invalidation tests |
| DoS via complex queries | Complexity/depth limits, rate limiting | Load tests, chaos tests |
| DB injection | Parameterized queries, least-privilege DB user | SQL audit, permissions review |
| Event manipulation | Idempotency keys, re-verify on-chain | Event replay tests |
| Missing audit logs | Structured logging, ELK shipping | Log review, SIEM alerts |

### 3.5 Deployment Security

| Threat | Mitigation | Verification |
|--------|-----------|--------------|
| CI/CD compromise | Workflow review, secret management | Code review, audit logs |
| Unauthorized deployment | GitHub Actions approval, access control | GitHub settings |
| Dependency vulnerabilities | Pinned versions, automated scanning | `npm audit`, `cargo audit` |

---

## 4. Security Checklist

### 4.1 Pre-Deployment Checklist

- [ ] All unit tests pass: `cargo test --workspace`
- [ ] All integration tests pass: `npm run test` (frontend)
- [ ] Backend service tests pass: `npm test` (indexer, graphql-api)
- [ ] No security warnings from `cargo audit`
- [ ] No security warnings from `npm audit`
- [ ] Code review completed by at least 2 team members
- [ ] Contract WASM hash is reproducible
- [ ] Environment variables are correctly set
- [ ] Secrets are stored in GitHub Secrets, not in code
- [ ] Deployment script is reviewed and tested
- [ ] Rollback plan is documented
- [ ] Bundle size budgets are verified (see [Bundle Budgets](./bundle-budgets.md))
- [ ] Rate limiter configuration reviewed and tested
- [ ] Database migration script tested on staging
- [ ] Redis connection string uses TLS in production

### 4.2 Post-Deployment Checklist

- [ ] Contract is deployed to the correct network (testnet/mainnet)
- [ ] Contract ID is verified on Stellar Expert
- [ ] WASM hash matches the published hash
- [ ] Campaign initialization parameters are correct
- [ ] Registry contract is updated with new campaign ID
- [ ] Frontend environment variables are updated
- [ ] Deployment is announced in release notes
- [ ] Monitoring and alerting are active
- [ ] Incident response team is on standby

### 4.3 Ongoing Security Checklist

- [ ] Security updates are applied within 7 days of release
- [ ] Dependency vulnerabilities are tracked and remediated
- [ ] Access logs are reviewed weekly
- [ ] Incident reports are reviewed and addressed
- [ ] Security documentation is kept up to date
- [ ] Team members complete security training annually
- [ ] Penetration testing is scheduled (annually for mainnet)

### 4.4 Code Review Checklist

When reviewing code changes, verify:

- [ ] No hardcoded secrets or API keys
- [ ] Input validation is present for all user inputs
- [ ] Error handling is appropriate (no information leakage)
- [ ] Access control checks are in place
- [ ] No use of unsafe code (Rust) or dangerous functions (JavaScript)
- [ ] Dependencies are from trusted sources
- [ ] Tests cover security-relevant code paths
- [ ] Documentation is clear and accurate

---

## 5. Incident Response

### 5.1 Incident Classification

| Severity | Impact | Response Time | Examples |
|----------|--------|----------------|----------|
| Critical | Funds at risk, contract compromise | Immediate (< 1 hour) | Unauthorized withdrawal, reentrancy |
| High | Significant security issue, data exposure | 4 hours | XSS vulnerability, phishing campaign |
| Medium | Moderate security issue, limited impact | 24 hours | Dependency vulnerability, weak validation |
| Low | Minor security issue, no immediate risk | 1 week | Documentation gap, outdated library |

### 5.2 Incident Response Procedure

#### Step 1: Detection & Reporting
- Security issue is reported via [GitHub Security Advisories](https://github.com/Fund-My-Cause/Fund-My-Cause/security/advisories/new)
- Reporter provides description, reproduction steps, and impact assessment
- Incident response team is notified immediately

#### Step 2: Initial Assessment (Within 1 hour for critical)
- Verify the vulnerability
- Assess the scope and impact
- Determine if funds are at risk
- Classify the severity
- Notify stakeholders

#### Step 3: Containment (Within 4 hours for critical)
- If contract is compromised: pause operations if possible
- If frontend is compromised: take down the interface
- If CI/CD is compromised: revoke access and audit logs
- Communicate status to users

#### Step 4: Investigation (Within 24 hours)
- Root cause analysis
- Determine affected components
- Identify all instances of the vulnerability
- Prepare fix or mitigation

#### Step 5: Remediation (Within 7 days for critical)
- Develop and test fix
- Deploy fix to testnet
- Conduct security review
- Deploy fix to mainnet
- Verify fix is effective

#### Step 6: Communication & Disclosure
- Notify affected users
- Publish security advisory
- Credit security researcher (if applicable)
- Update documentation
- Post-mortem analysis

#### Step 7: Post-Incident Review
- Document lessons learned
- Update security procedures
- Implement preventive measures
- Schedule follow-up security audit

### 5.3 Incident Response Contacts

| Role | Contact | Backup |
|------|---------|--------|
| Security Lead | [security@fund-my-cause.org] | [backup-security@fund-my-cause.org] |
| Incident Commander | [incident-commander@fund-my-cause.org] | [backup-ic@fund-my-cause.org] |
| DevOps Lead | [devops@fund-my-cause.org] | [backup-devops@fund-my-cause.org] |

### 5.4 Communication Template

**Subject**: Security Advisory - Fund-My-Cause [SEVERITY]

```
Dear Fund-My-Cause Users,

We have identified and resolved a [SEVERITY] security issue in [COMPONENT].

**What happened:**
[Description of the vulnerability]

**Who is affected:**
[Affected users/campaigns]

**What we did:**
[Mitigation steps taken]

**What you should do:**
[Recommended user actions]

**Timeline:**
- [Date]: Issue discovered
- [Date]: Fix deployed
- [Date]: Public disclosure

For more information, see [Security Advisory Link].

Thank you for your trust in Fund-My-Cause.

Security Team
```

### 5.5 Rollback Procedure

If a deployment introduces a critical security issue:

1. **Immediate**: Revert the deployment to the previous version
2. **Within 1 hour**: Notify users of the rollback
3. **Within 4 hours**: Root cause analysis
4. **Within 24 hours**: Fix and re-test
5. **Within 48 hours**: Re-deploy with fix

Rollback commands:
```bash
# Revert to previous contract version
git revert <COMMIT_SHA>
./scripts/deploy.sh <CREATOR> <TOKEN> <GOAL> <DEADLINE> <MIN_CONTRIB> <TITLE> <DESC> <LINKS> <REGISTRY_ID>

# Revert frontend deployment
git revert <COMMIT_SHA>
npm run build
# Deploy to hosting platform
```

---

## 6. Security Resources

- [SECURITY.md](../SECURITY.md) - Vulnerability reporting policy
- [Security Best Practices](./security-best-practices.md) - User security guidance
- [Security Audit](./security-audit.md) - Audit findings and remediation
- [Stellar Security](https://developers.stellar.org/docs/learn/security) - Stellar security guidelines
- [Soroban Security](https://soroban.stellar.org/docs/learn/security) - Soroban security best practices

---

## 7. Open Mitigations & Follow-Up Issues

The following mitigations are tracked as separate issues and should be addressed in future sprints:

| ID | Threat | Mitigation | Priority | Status |
|----|--------|-----------|----------|--------|
| #TBD-1 | Indexer RPC connection has no backup endpoint | Add secondary RPC URL fallback | Medium | Open |
| #TBD-2 | GraphQL API lacks request body size limit for subscriptions | Enforce `maxPayload` on WebSocket connections | Medium | Open |
| #TBD-3 | PostgreSQL credentials stored in plaintext env var | Migrate to secrets manager (Vault / AWS Secrets Manager) | High | Open |
| #TBD-4 | No automated DB backup integrity verification | Add backup restore test to CI | Medium | Open |
| #TBD-5 | Redis exposed on `0.0.0.0` in development docker-compose | Bind to localhost; add `requirepass` | High | Open |
| #TBD-6 | JWT secret uses hardcoded fallback in dev | Enforce JWT_SECRET env var in all environments | High | Open |
| #TBD-7 | No TLS termination at the GraphQL API layer | Terminate TLS at reverse proxy (nginx/Cloudflare) | High | Open |
| #TBD-8 | Rate-limiter missing per-endpoint granularity | Add per-route rate limits for expensive queries | Low | Open |
| #TBD-9 | No intrusion detection on backend services | Deploy Falco / WAF rules for API traffic | Medium | Open |
| #TBD-10 | Event ingestion has no downstream schema validation | Add JSON Schema validation before DB insert | Medium | Open |

---

## 8. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-01 | Initial security model and threat analysis |
| 1.1 | 2026-06-29 | Added backend data flows (indexer, GraphQL API), STRIDE threat analysis for backend services, open mitigations tracking |

---

**Last Updated**: 2026-06-29  
**Next Review**: 2026-09-29  
**Maintained By**: Security Team
