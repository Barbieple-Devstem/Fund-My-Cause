# Security Best Practices & Vulnerability Management Policy

## Table of Contents
1. [Overview](#overview)
2. [Severity-Based Remediation SLAs](#severity-based-remediation-slas)
3. [Current Vulnerability Triage](#current-vulnerability-triage)
4. [Remediation Process](#remediation-process)
5. [Accepted Risk Policy](#accepted-risk-policy)
6. [Dependency Management](#dependency-management)
7. [Security Scanning Tools](#security-scanning-tools)
8. [Escalation Procedures](#escalation-procedures)

---

## Overview

This document defines the security vulnerability management policy for Fund-My-Cause, including:
- Severity-based Service Level Agreements (SLAs) for remediation
- Current vulnerability triage and acceptance rationale
- Procedures for ongoing vulnerability management
- Best practices for secure development

**Policy Owner:** Security Team  
**Last Updated:** June 28, 2026  
**Review Frequency:** Quarterly

---

## Severity-Based Remediation SLAs

### SLA Matrix

| Severity | CVSS Score | Response Time | Remediation Time | Stakeholder Notification |
|----------|------------|---------------|------------------|--------------------------|
| **CRITICAL** | 9.0 - 10.0 | 4 hours | 24 hours | Immediate (within 1 hour) |
| **HIGH** | 7.0 - 8.9 | 8 hours | 7 days | Within 24 hours |
| **MODERATE** | 4.0 - 6.9 | 24 hours | 30 days | Within 72 hours |
| **LOW** | 0.1 - 3.9 | 72 hours | 90 days | Next sprint planning |

### SLA Definitions

**Response Time:** Time from vulnerability discovery to initial assessment and acknowledgment.

**Remediation Time:** Time from discovery to deployment of fix or documented acceptance.

**Stakeholder Notification:** Time to notify project leads, security team, and relevant developers.

### Exceptions

SLAs may be extended in the following cases:
1. **No patch available** - Vendor has not released a fix
2. **Breaking changes required** - Major version upgrades needed
3. **False positives** - After verification, finding is not exploitable
4. **Mitigating controls** - Compensating controls reduce actual risk

All exceptions must be documented in the [Accepted Risk Registry](#accepted-risk-registry).

---

## Current Vulnerability Triage

**Audit Date:** June 28, 2026  
**Audit Command:** `npm audit --audit-level=moderate`  
**Total Vulnerabilities:** 34 (0 Critical, 10 High, 22 Moderate, 2 Low)

### High Severity Findings

#### 1. Next.js Vulnerabilities (Multiple CVEs)
**Package:** `next@16.0.6`  
**Affected Versions:** 16.0.0 - 16.2.5  
**Fix Available:** Yes (`next@16.2.9`)  
**CVEs:**
- GHSA-c4j6-fc7j-m34r (CVSS 8.6) - Server-Side Request Forgery (SSRF) in WebSocket upgrades
- GHSA-492v-c6pp-mqqv (CVSS 8.1) - Middleware/Proxy bypass via dynamic route parameter injection
- GHSA-q4gf-8mx6-v5v3 (CVSS 7.5) - Denial of Service with Server Components
- GHSA-8h8q-6873-q5fj (CVSS 7.5) - Denial of Service with Server Components
- GHSA-26hh-7cqf-hhc6 (CVSS 7.5) - Middleware/Proxy bypass (incomplete fix follow-up)
- GHSA-mg66-mrh9-m8jx (CVSS 7.5) - DoS via connection exhaustion with Cache Components
- GHSA-267c-6grr-h53f (CVSS 7.5) - Middleware/Proxy bypass via segment-prefetch routes
- GHSA-36qx-fr4f-26g5 (CVSS 7.5) - Middleware/Proxy bypass in Pages Router with i18n

**Status:** ✅ **REMEDIATION REQUIRED**  
**Action:** Upgrade to `next@16.2.9` or later  
**Timeline:** Within 7 days (High severity SLA)  
**Rationale:** Multiple high-severity vulnerabilities affecting core routing, middleware, and DoS protections. Upgrade path is straightforward with no breaking changes.

#### 2. Axios Vulnerabilities (Multiple CVEs)
**Package:** `axios@1.7.9`  
**Affected Versions:** 1.0.0 - 1.15.2  
**Fix Available:** Yes (`axios@1.15.3+`)  
**Notable CVEs:**
- GHSA-pf86-5x62-jrwf (High) - Prototype Pollution gadgets enabling response tampering
- GHSA-35jp-ww65-95wh (High) - Full Man-in-the-Middle via prototype pollution
- GHSA-m7pr-hjqh-92cm (High) - NO_PROXY bypass via IP alias allows SSRF
- Multiple high-severity prototype pollution and injection vulnerabilities

**Status:** ✅ **REMEDIATION REQUIRED**  
**Action:** Upgrade to `axios@1.15.3` or later  
**Timeline:** Within 7 days (High severity SLA)  
**Rationale:** Critical security library with multiple high-severity vulnerabilities. Widely used across the application for HTTP requests.

#### 3. Defu Prototype Pollution
**Package:** `defu@6.1.4`  
**CVE:** GHSA-737v-mqg7-c878  
**Severity:** High  
**Fix Available:** Yes (`defu@6.1.5+`)

**Status:** ✅ **REMEDIATION REQUIRED**  
**Action:** Upgrade to latest defu version  
**Timeline:** Within 7 days (High severity SLA)

#### 4. Fast-URI Path Traversal & Host Confusion
**Package:** `fast-uri@3.1.1`  
**CVEs:**
- GHSA-q3j6-qgpj-74h6 - Path traversal via percent-encoded dot segments
- GHSA-v39h-62p7-jpjc - Host confusion via percent-encoded authority delimiters

**Status:** ✅ **REMEDIATION REQUIRED**  
**Action:** Upgrade to `fast-uri@3.2.0+`  
**Timeline:** Within 7 days (High severity SLA)

#### 5. Form-Data CRLF Injection
**Package:** `form-data@4.0.5`  
**CVE:** GHSA-hmw2-7cc7-3qx  
**Severity:** High

**Status:** ✅ **REMEDIATION REQUIRED**  
**Action:** Upgrade to `form-data@4.0.6+`  
**Timeline:** Within 7 days (High severity SLA)

#### 6. Glob Command Injection
**Package:** `glob@10.4.5` (in apps/interface)  
**CVE:** GHSA-5j98-mcp5-4vw2  
**Severity:** High  
**Fix Available:** Yes (via `eslint-config-next@16.2.9` upgrade)

**Status:** ⚠️ **ACCEPTED RISK** (with conditions)  
**Rationale:**
- Vulnerability only affects CLI usage with `-c/--cmd` flag
- Application does not use glob CLI features, only programmatic API
- Fix requires major version upgrade of eslint-config-next (breaking change)
- Mitigating control: glob is only used in build/dev environment, not production runtime
- **Compensating Controls:** 
  - Never execute glob CLI commands
  - Regular dependency audit reviews
  - Isolated build environment
- **Review Date:** Next major dependency upgrade cycle (Q3 2026)

#### 7. Vite Security Vulnerabilities
**Package:** `vite@8.0.4`  
**CVEs:**
- GHSA-v2wj-q39q-566r (High) - `server.fs.deny` bypassed with queries
- GHSA-p9ff-h696-f583 (High) - Arbitrary File Read via WebSocket
- GHSA-fx2h-pf6j-xcff (High) - `server.fs.deny` bypass on Windows alternate paths

**Status:** ✅ **REMEDIATION REQUIRED**  
**Action:** Upgrade to `vite@8.0.16+` or `vite@9.x`  
**Timeline:** Within 7 days (High severity SLA)  
**Rationale:** Multiple path traversal and file read vulnerabilities in dev server. Although primarily affects development environment, should be patched.

#### 8. WebSocket (ws) Memory Exhaustion DoS
**Package:** `ws@8.20.0`  
**CVEs:**
- GHSA-96hv-2xvq-fx4p (CVSS 7.5) - Memory exhaustion DoS from tiny fragments

**Status:** ✅ **REMEDIATION REQUIRED**  
**Action:** Upgrade to `ws@8.21.0+`  
**Timeline:** Within 7 days (High severity SLA)  
**Rationale:** DoS vulnerability in WebSocket implementation used by WalletConnect and dev tooling.

### Moderate Severity Findings

#### 1. Babel Core - Arbitrary File Read
**Package:** `@babel/core@7.29.0`  
**CVE:** GHSA-4x5r-pxfx-6jf8  
**Severity:** Moderate

**Status:** ⚠️ **ACCEPTED RISK**  
**Rationale:**
- Requires attacker to control sourceMappingURL comment in transpiled code
- Only affects build-time environment, not production runtime
- Babel only used in development and CI/CD pipeline
- **Compensating Controls:**
  - Isolated build environment
  - No user-generated code in build pipeline
  - Regular dependency updates
- **Review Date:** Q4 2026

#### 2. Brace-Expansion DoS
**Package:** `brace-expansion@1.1.12` and `5.0.5`  
**CVEs:**
- GHSA-f886-m6hf-6m8v - Zero-step sequence causes process hang
- GHSA-jxxr-4gwj-5jf2 - Large numeric range defeats DoS protection

**Status:** ⚠️ **ACCEPTED RISK**  
**Rationale:**
- Used by minimatch/glob in development tooling only
- Not exposed to user input in production
- Build environment has timeout protections
- **Compensating Controls:**
  - CI/CD timeout limits (30 min max)
  - No user input to glob patterns
- **Review Date:** Next dependency update cycle

#### 3. Follow-Redirects Header Leakage
**Package:** `follow-redirects@1.15.11`  
**CVE:** GHSA-r4q5-vmmm-2653  
**Severity:** Moderate

**Status:** ✅ **REMEDIATION REQUIRED**  
**Action:** Upgrade to `follow-redirects@1.15.12+`  
**Timeline:** Within 30 days (Moderate severity SLA)

#### 4. ICU-Minify Prototype Pollution
**Package:** `icu-minify@4.9.1`  
**CVE:** GHSA-r27j-894h-3w3p  
**Severity:** Moderate

**Status:** ✅ **REMEDIATION REQUIRED**  
**Action:** Upgrade to `icu-minify@4.9.2+`  
**Timeline:** Within 30 days (Moderate severity SLA)

#### 5. JS-YAML DoS
**Package:** `js-yaml@4.1.1`  
**CVE:** GHSA-h67p-54hq-rp68  
**Severity:** Moderate  
**Fix:** Requires breaking change (`ts-jest@29.1.2`)

**Status:** ⚠️ **ACCEPTED RISK**  
**Rationale:**
- Only used in test configuration (jest)
- Not exposed to production or user input
- Fix requires major version upgrade breaking test infrastructure
- **Compensating Controls:**
  - YAML files are developer-controlled only
  - No user-supplied YAML parsing
- **Review Date:** Next test framework upgrade (when migrating to Vitest or Jest 30+)

#### 6. Next-Intl Prototype Pollution
**Package:** `next-intl@4.9.1`  
**CVE:** GHSA-4c35-wcg5-mm9h  
**Severity:** Moderate (CVSS 4.2)

**Status:** ✅ **REMEDIATION REQUIRED**  
**Action:** Upgrade to `next-intl@4.9.2+`  
**Timeline:** Within 30 days (Moderate severity SLA)  
**Rationale:** Requires experimental feature and attacker control of translation catalogs, but should still be patched.

#### 7. PostCSS XSS
**Package:** `postcss@8.5.9`  
**CVE:** GHSA-qx2v-qp2m-jg93  
**Severity:** Moderate (CVSS 6.1)

**Status:** ✅ **REMEDIATION REQUIRED** (via Next.js upgrade)  
**Action:** Fixed by upgrading to `next@16.2.9`  
**Timeline:** Within 30 days (covered by Next.js upgrade)

#### 8. Additional Moderate Findings
All remaining moderate-severity findings in axios, next.js, and other packages will be resolved through the primary package upgrades listed above.

### Low Severity Findings

#### 1. Next.js Low Severity Issues
- GHSA-jcc7-9wpm-mj36 - HMR websocket CSRF (dev only)
- GHSA-3g8h-86w9-wvmq - Middleware cache poisoning
- GHSA-vfv6-92ff-j949 - RSC cache-busting collisions

**Status:** ⚠️ **ACCEPTED RISK**  
**Rationale:**
- Only affect development environment (HMR) or have low exploitability
- Will be fixed with Next.js upgrade but not prioritized
- **Review Date:** Ongoing with Next.js updates

#### 2. WebSocket (ws) Uninitialized Memory Disclosure
**Package:** `ws@7.5.10`  
**CVE:** GHSA-58qx-3vcg-4xpx  
**Severity:** Moderate (CVSS 4.4) - downgraded to Low for our context

**Status:** ⚠️ **ACCEPTED RISK**  
**Rationale:**
- Requires attacker with privileged network access (CVSS:AV:N/AC:H/PR:H)
- Used in dev/build environment only
- Will be upgraded with main ws upgrade
- **Review Date:** Q3 2026

---

## Remediation Process

### Standard Remediation Workflow

```
┌─────────────────────┐
│ Vulnerability       │
│ Discovered          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Initial Triage      │◄──── Response Time SLA
│ - Assess severity   │
│ - Check exploitability
└──────────┬──────────┘
           │
           ▼
     ┌────┴────┐
     │ Decision │
     └────┬────┘
          │
    ┌─────┼─────┐
    │     │     │
    ▼     ▼     ▼
┌──────┐ ┌──────────┐ ┌───────────┐
│Fix   │ │Accept    │ │False      │
│      │ │Risk      │ │Positive   │
└───┬──┘ └────┬─────┘ └─────┬─────┘
    │         │              │
    ▼         ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│Implement │ │Document  │ │Document  │
│& Test    │ │Rationale │ │& Dismiss │
└────┬─────┘ └────┬─────┘ └─────┬────┘
     │            │              │
     ▼            ▼              ▼
┌─────────────────────────────────┐
│ Update Triage Document          │◄──── Remediation Time SLA
│ & Close Ticket                  │
└─────────────────────────────────┘
```

### Step-by-Step Process

1. **Discovery**
   - Automated: GitHub Security Alerts, npm audit, cargo audit
   - Manual: Security research, bug bounty, penetration testing

2. **Initial Triage** (within SLA response time)
   - Verify vulnerability is legitimate
   - Assess actual exploitability in our context
   - Determine severity based on CVSS + environmental factors
   - Assign owner

3. **Risk Assessment**
   - Analyze attack vectors
   - Evaluate existing mitigating controls
   - Determine business impact
   - Calculate residual risk

4. **Remediation Decision**
   - **Fix:** Patch available and non-breaking
   - **Accept:** Mitigated or low residual risk
   - **Dismiss:** False positive or not applicable

5. **Implementation** (within SLA remediation time)
   - Apply patches/upgrades
   - Test functionality
   - Verify fix with re-audit
   - Deploy to environments

6. **Documentation**
   - Update this document
   - Add to CHANGELOG.md
   - Create GitHub issue/PR
   - Notify stakeholders

---

## Accepted Risk Policy

### Criteria for Risk Acceptance

A vulnerability may be accepted (not fixed) if ALL of the following apply:

1. **Severity:** Moderate or below (CVSS < 7.0)
2. **Mitigating Controls:** Compensating controls reduce residual risk to acceptable levels
3. **Exploitability:** Low exploitability in production environment
4. **Business Impact:** Fix would cause significant disruption (breaking changes, major refactoring)
5. **Approval:** Documented approval from Security Lead + Technical Lead

### Accepted Risk Registry

| ID | Package | CVE | Severity | Acceptance Date | Review Date | Rationale | Approver |
|----|---------|-----|----------|----------------|-------------|-----------|----------|
| AR-001 | glob | GHSA-5j98-mcp5-4vw2 | High* | 2026-06-28 | 2026-09-30 | CLI-only vuln, not used; build env only | Security Team |
| AR-002 | @babel/core | GHSA-4x5r-pxfx-6jf8 | Moderate | 2026-06-28 | 2026-12-31 | Build-time only, isolated environment | Security Team |
| AR-003 | brace-expansion | GHSA-f886-m6hf-6m8v | Moderate | 2026-06-28 | 2026-09-30 | Dev tooling only, timeout protections | Security Team |
| AR-004 | js-yaml | GHSA-h67p-54hq-rp68 | Moderate | 2026-06-28 | 2026-12-31 | Test config only, dev-controlled input | Security Team |

**Note:** High severity items can only be accepted with exceptional approval and strong compensating controls.

### Review Process

- **Quarterly Reviews:** All accepted risks reviewed every 90 days
- **Trigger Events:** New exploits, security incidents, or environmental changes require immediate re-review
- **Expiration:** Accepted risks expire after 1 year and must be re-evaluated

---

## Dependency Management

### Dependency Selection Criteria

Before adding new dependencies:

1. **Security Assessment**
   - Check security advisory history
   - Review maintainer reputation
   - Assess update frequency
   - Verify active maintenance

2. **License Compliance**
   - Verify license compatibility
   - Document license in NOTICE file
   - Avoid GPL/AGPL unless approved

3. **Quality Standards**
   - Minimum test coverage > 80%
   - Active community support
   - Regular releases (< 6 months since last)
   - TypeScript support (for npm packages)

### Update Policy

**Regular Updates:**
- **Security patches:** Immediate (within SLA)
- **Minor versions:** Monthly dependency update cycle
- **Major versions:** Quarterly major upgrade reviews

**Automated Updates:**
- Dependabot enabled for security patches
- Automated PR creation for patch/minor versions
- Manual review required for major versions

**Testing Requirements:**
- All updates must pass CI/CD pipeline
- Breaking changes require migration testing
- Security updates expedited through approval process

### Pinning Strategy

```json
{
  "dependencies": {
    "critical-lib": "1.2.3",        // Exact version for production-critical
    "standard-lib": "^2.0.0",       // Caret for standard dependencies
    "dev-tool": "~3.1.0"            // Tilde for dev dependencies
  }
}
```

**Production Dependencies:** Use exact or caret (^) with lockfile
**Development Dependencies:** Use tilde (~) or caret (^)
**Critical Security Libraries:** Consider exact versions with manual updates

---

## Security Scanning Tools

### Automated Scanning

| Tool | Purpose | Frequency | Alert Threshold |
|------|---------|-----------|-----------------|
| npm audit | npm vulnerability scan | Pre-commit, PR, Daily | Moderate+ |
| cargo audit | Rust crate scan | PR, Daily | All |
| Semgrep | SAST code analysis | PR, Daily | Medium+ |
| Trivy | Container scanning | Build, Daily | High+ |
| TruffleHog | Secret detection | Pre-commit, PR | All verified |
| Dependabot | Dependency alerts | Continuous | All |
| OWASP Dependency-Check | SCA analysis | Daily | All |

### Manual Reviews

- **Code Review:** Security-focused review for all PRs touching auth, crypto, data handling
- **Penetration Testing:** Annual third-party pen test
- **Architecture Review:** Quarterly security architecture review
- **Dependency Audit:** Monthly manual review of new/updated dependencies

### Tool Configuration

See `.github/workflows/security-scanning.yml` and `docs/security-scanning.md` for full configuration details.

---

## Escalation Procedures

### Escalation Paths

```
Level 1: Developer discovers vulnerability
  ↓ (< 4 hours for Critical)
Level 2: Security Team triages and assesses
  ↓ (if Critical or High with active exploit)
Level 3: Engineering Lead + Security Lead
  ↓ (if requires emergency patching)
Level 4: CTO + Emergency Response Team
```

### Contact Information

| Role | Contact | Availability |
|------|---------|--------------|
| Security Team | security@fund-my-cause.dev | 24/7 for Critical |
| Engineering Lead | eng-lead@fund-my-cause.dev | Business hours |
| CTO | cto@fund-my-cause.dev | On-call for Critical |

### Emergency Response

**Critical Vulnerability Response:**

1. **Hour 0-1:** Initial discovery and verification
2. **Hour 1-4:** Security team assessment and stakeholder notification
3. **Hour 4-8:** Emergency fix development and testing
4. **Hour 8-24:** Deployment to production
5. **Hour 24-48:** Post-incident review and documentation

**Communication Protocol:**
- Slack #security-alerts (immediate)
- Email to security@fund-my-cause.dev
- GitHub Security Advisory (for coordinated disclosure)
- Status page update (for user-impacting issues)

---

## Best Practices for Developers

### Secure Coding Practices

1. **Input Validation**
   - Validate all user input
   - Use schema validation (Zod, yup)
   - Sanitize before display (XSS prevention)

2. **Authentication & Authorization**
   - Use established libraries (Freighter, LOBSTR adapters)
   - Never roll custom crypto
   - Implement principle of least privilege

3. **Data Protection**
   - Encrypt sensitive data at rest
   - Use TLS for all network traffic
   - Sanitize logs (no secrets)

4. **Error Handling**
   - No sensitive data in error messages
   - Log errors securely
   - Use generic error responses to users

5. **Dependency Security**
   - Run `npm audit` before committing
   - Review security advisories for new dependencies
   - Keep dependencies up-to-date

### Pre-Commit Checklist

- [ ] Run `npm audit` (no high/critical findings)
- [ ] Run linters (ESLint, Clippy)
- [ ] No secrets in code
- [ ] Security tests pass
- [ ] Code reviewed for security issues

---

## Compliance & Reporting

### Regulatory Compliance

**Applicable Standards:**
- OWASP Top 10 (2021)
- CWE/SANS Top 25
- NIST Cybersecurity Framework
- SOC 2 Type II (planned)

### Metrics & Reporting

**Key Metrics:**
- Mean Time to Detect (MTTD) vulnerabilities
- Mean Time to Respond (MTTR)
- SLA compliance rate
- Number of accepted risks
- Vulnerability backlog age

**Reports:**
- **Weekly:** Vulnerability status dashboard
- **Monthly:** Security metrics report
- **Quarterly:** Comprehensive security review
- **Annual:** Third-party audit and certification

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-28 | Security Team | Initial policy creation with SLAs and current triage |

---

## References

- [Security Scanning Documentation](./security-scanning.md)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CVSS v3.1 Calculator](https://www.first.org/cvss/calculator/3.1)
- [npm audit Documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [cargo-audit Documentation](https://github.com/RustSec/rustsec/tree/main/cargo-audit)
- [GitHub Security Advisories](https://github.com/advisories)

---

**Policy Approval:**

This policy has been reviewed and approved by:
- Security Team Lead
- Engineering Lead  
- Technical Architect

**Next Review Date:** September 28, 2026
