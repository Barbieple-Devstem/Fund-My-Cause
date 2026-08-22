# Creator Handbook

This handbook walks you through every stage of running a successful crowdfunding campaign on Fund-My-Cause — from planning through withdrawal.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Planning Your Campaign](#planning-your-campaign)
3. [Campaign Creation](#campaign-creation)
4. [Setting Your Goal and Deadline](#setting-your-goal-and-deadline)
5. [Metadata Best Practices](#metadata-best-practices)
6. [Platform Fee](#platform-fee)
7. [Milestones and Progress Updates](#milestones-and-progress-updates)
8. [Managing Your Campaign](#managing-your-campaign)
9. [Withdrawal Process](#withdrawal-process)
10. [Refunds Explained](#refunds-explained)
11. [Promoting Your Campaign](#promoting-your-campaign)
12. [Campaign Lifecycle Reference](#campaign-lifecycle-reference)
13. [Launch Checklist](#launch-checklist)
14. [Related Docs](#related-docs)

---

## Prerequisites

Before you start, make sure you have:

- A [Freighter wallet](https://www.freighter.app/) installed and funded with XLM (for transaction fees)
- The Stellar CLI (v21.0+) installed — see the [deployment guide](./deployment.md)
- A deployed crowdfund contract — or use `scripts/deploy.sh` to deploy one

---

## Planning Your Campaign

A well-planned campaign raises more funds. Before deploying, answer these questions:

**Goal**
- What is the minimum amount needed to deliver the project?
- Is the goal realistic given your audience size?
- XLM amounts are in stroops (1 XLM = 10,000,000 stroops).

**Deadline**
- How long do contributors need to discover and fund the campaign?
- Most successful campaigns run 2–6 weeks.
- Build in buffer for announcement delays.

**Story**
- Can you explain the campaign goal in two sentences?
- Do you have a clear description of how funds will be spent?
- What happens if the goal is exceeded? (Note: excess funds go to the creator; the contract does not cap contributions above the goal.)

**Audience**
- Where will you announce the campaign?
- Do you have social links ready to embed?

---

## Campaign Creation

A campaign is created by deploying a crowdfund contract and calling `initialize`. Each contract instance is one campaign.

### 1. Build the contract

```bash
cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/crowdfund/Cargo.toml
```

### 2. Deploy and initialize

Use the deploy script, which handles deployment, initialization, and registry registration in one step:

```bash
DEADLINE=$(date -d "+30 days" +%s)

./scripts/deploy.sh \
  <CREATOR_ADDRESS> \
  <TOKEN_ADDRESS> \
  <GOAL_IN_STROOPS> \
  $DEADLINE \
  <MIN_CONTRIBUTION_IN_STROOPS> \
  "Campaign Title" \
  "Campaign description" \
  null \
  [REGISTRY_CONTRACT_ID]
```

Save the printed `Contract ID` and `Registry ID` — you need them for the frontend `.env.local`.

**Example — 1,000 XLM goal, 30-day campaign, 1 XLM minimum:**

```bash
DEADLINE=$(date -d "+30 days" +%s)
./scripts/deploy.sh \
  GCREATORADDRESS... \
  native \
  10000000000 \
  $DEADLINE \
  10000000 \
  "Fund My Open Source Library" \
  "We are building a permissively licensed Soroban SDK. Funds will cover 3 months of full-time development." \
  '["https://github.com/myorg/mylib","https://twitter.com/myhandle"]'
```

### 3. Configure the frontend

```bash
NEXT_PUBLIC_CROWDFUND_CONTRACT_ID=<CONTRACT_ID>
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=<REGISTRY_ID>
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

### 4. Verify deployment

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- get_stats
```

You should see your goal, deadline, and `total_raised: 0` in the output.

---

## Setting Your Goal and Deadline

### Goal

- Specified in **stroops** (1 XLM = 10,000,000 stroops)
- Must be greater than `0`
- Example: a 1,000 XLM goal → `10000000000`

The campaign is marked `Successful` only if `total_raised >= goal` by the deadline. If the goal is not met, the campaign moves to `Refunded` status and contributors can claim their funds back.

**Tips:**
- Set a realistic, achievable goal — over-ambitious goals lead to refunds and damage credibility.
- If you expect to exceed the goal, consider using milestone-based communication rather than a higher goal (contributors are more willing to fund a clear, bounded ask).
- You can always run a second campaign after a successful first one.

### Deadline

- Specified as a **Unix timestamp** (seconds)
- Must be in the future at the time of initialization
- Example: 30 days from now → `$(date -d "+30 days" +%s)`

**Tips:**
- 21–30 days is a sweet spot — long enough for word to spread, short enough to create urgency.
- Avoid ending on a weekend or holiday when contributors may be less active.
- You can extend the deadline after launch using `extend_deadline`, but you cannot shorten it.

### Minimum Contribution

- Also in stroops; set to `0` to allow any amount
- Helps filter out dust contributions and keeps the contributor list manageable
- Example: 1 XLM minimum → `10000000`

---

## Metadata Best Practices

Metadata is set at initialization and can be updated any time while the campaign is `Active` via `update_metadata`.

### Title

- Keep it short and descriptive (under 60 characters recommended)
- Make it clear what you're funding — avoid vague names like "My Project"
- Good: `"Open Source Stellar SDK — 3-Month Sprint"`
- Avoid: `"Funding Round 1"`

### Description

- Explain what the campaign is for, how funds will be used, and what happens if the goal is met
- Include a clear call to action
- Markdown is rendered in the frontend — use it for structure
- Recommended structure:
  1. One-line summary
  2. Problem you're solving
  3. How funds will be used (be specific)
  4. Your background/credibility
  5. Call to action with contribution link

### Social Links

Pass an array of URLs to connect your campaign to external profiles or updates:

```bash
--social_links '["https://twitter.com/yourhandle", "https://yourproject.com"]'
```

These are displayed in the campaign UI and help contributors verify legitimacy. Include at minimum a project site or GitHub repo.

### Updating Metadata

While the campaign is `Active`, you can update title, description, and social links without redeploying:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  --source <CREATOR_ADDRESS> \
  -- update_metadata \
  --title "Updated Title" \
  --description "Updated description with milestone progress" \
  --social_links '["https://yourproject.com/update-1"]'
```

Use `update_metadata` to post progress updates — this is the primary communication channel with contributors while the campaign is live.

---

## Platform Fee

An optional `PlatformConfig` can be set at initialization with a fee in basis points.

| Value | Meaning |
|-------|---------|
| `0` | No platform fee |
| `250` | 2.5% fee |
| `500` | 5% fee |
| `10000` | 100% (maximum, not recommended) |

The fee is deducted automatically from the creator's payout at withdrawal and sent to the configured platform address. It is **not** visible to contributors.

**Example with 2.5% fee:**
```bash
./scripts/deploy.sh \
  <CREATOR> <TOKEN> <GOAL> <DEADLINE> <MIN> "Title" "Desc" null \
  --platform_fee_bps 250 \
  --platform_address GPLATFORMADDRESS...
```

If you are running a self-hosted deployment without a platform intermediary, set fee to `0` or omit `PlatformConfig`.

---

## Milestones and Progress Updates

Fund-My-Cause does not enforce on-chain milestones, but communicating progress is critical for donor confidence.

### Recommended Milestone Pattern

Define milestones in your description at launch and update regularly:

```
## Milestones

- [ ] Week 1 — Announce beta testing program (target: 25% funded)
- [ ] Week 2 — Release first public build (target: 50% funded)
- [ ] Week 3 — Integration tests complete (target: 75% funded)
- [ ] Week 4 — v1.0 release (target: 100% funded)
```

Update the description via `update_metadata` as each milestone is reached, checking boxes and adding brief notes.

### Tracking Progress On-Chain

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- get_stats
```

The response includes:
- `total_raised` — amount raised so far
- `progress_bps` — funding progress in basis points (10000 = 100%)
- `contributor_count` — number of unique contributors
- `goal` — your target

Share these numbers in your social updates to build momentum.

---

## Managing Your Campaign

### Pausing Contributions

If you need to pause contributions temporarily (e.g. to investigate a suspicious activity):

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  --source <CREATOR_ADDRESS> \
  -- pause
```

Contributors cannot contribute while paused. Resume with `unpause`.

### Extending the Deadline

```bash
NEW_DEADLINE=$(date -d "+14 days" +%s)

stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  --source <CREATOR_ADDRESS> \
  -- extend_deadline \
  --new_deadline $NEW_DEADLINE
```

The new deadline must be later than the current one.

### Cancelling the Campaign

If you need to cancel entirely:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  --source <CREATOR_ADDRESS> \
  -- cancel_campaign
```

Once cancelled, contributors can call `refund_single` to reclaim their contributions. Cancellation is irreversible — a cancelled campaign cannot be reactivated.

---

## Withdrawal Process

Once the campaign deadline passes and the goal is met, the contract status becomes `Successful` and you can withdraw funds.

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  --source <CREATOR_ADDRESS> \
  -- withdraw
```

- Only the creator address can call `withdraw`
- If a `PlatformConfig` was set, the platform fee is deducted automatically before the remainder is transferred to you
- Withdrawal can only happen once — the contract moves to a terminal state after

**What you receive:** `total_raised - (total_raised × fee_bps / 10000)`

Example: 1,000 XLM raised with 2.5% fee → you receive 975 XLM; platform receives 25 XLM.

### Withdrawal is unavailable if:
- The deadline has not passed yet (`CampaignStillActive`)
- The goal was not met (`GoalNotReached`) — contributors receive refunds instead
- The campaign was cancelled

---

## Refunds Explained

Fund-My-Cause uses a **pull-based refund model**. When the goal is not met or the campaign is cancelled, **each contributor individually calls `refund_single`** to claim their own funds.

You, as the creator, do not need to initiate or manage refunds. The contract handles the logic automatically.

### Why pull-based?

- A single transaction refunding hundreds of contributors would exceed gas limits and fail at scale
- Each contributor controls when they claim their refund
- The model is more reliable and decentralized

### What contributors see

When a campaign enters `Refunded` or `Cancelled` status, the UI shows a "Claim Refund" button to each contributor. They click it, sign the transaction, and receive their contribution back.

### As the creator

- Communicate clearly if a campaign did not meet its goal
- Update the description to acknowledge the outcome and thank contributors
- Consider announcing plans for a follow-up campaign

---

## Promoting Your Campaign

On-chain campaigns succeed or fail based on visibility. Practical strategies:

### Before Launch
- Prepare your announcement assets (tweet, blog post, Discord message)
- Line up early supporters to contribute in the first 24 hours — momentum matters
- Set up your social links in the contract before going live

### During the Campaign
- **Share the campaign link** — `https://<your-frontend-domain>/?campaign=<CONTRACT_ID>`
- **Post regular updates** via `update_metadata` — aim for at least one update per week
- **Share `get_stats` output** — total raised, contributor count, and progress percentage build social proof
- **Create urgency** — post reminders as the deadline approaches (3 days left, 24 hours left)
- **Engage with contributors** — respond to questions in your social channels

### Analytics
```bash
# Quick campaign summary
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- get_stats

# Check your total raised
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- total_raised
```

---

## Campaign Lifecycle Reference

| Status | Meaning | Creator actions available |
|--------|---------|--------------------------|
| `Active` | Accepting contributions | `update_metadata`, `extend_deadline`, `pause`, `cancel_campaign` |
| `Paused` | Contributions paused | `unpause`, `cancel_campaign` |
| `Successful` | Goal met, deadline passed | `withdraw` |
| `Refunded` | Goal not met, deadline passed | None (contributors call `refund_single`) |
| `Cancelled` | Creator cancelled | None (contributors call `refund_single`) |

---

## Launch Checklist

Copy and use this checklist before going live:

```
## Pre-Launch
- [ ] Wallet funded with enough XLM for transaction fees (~5 XLM is sufficient)
- [ ] Stellar CLI installed and configured for the correct network
- [ ] Goal amount calculated in stroops (XLM × 10,000,000)
- [ ] Deadline set as Unix timestamp (at least 14 days in the future recommended)
- [ ] Minimum contribution decided (0 = any amount)
- [ ] Title is under 60 characters and clearly describes the campaign
- [ ] Description written with: summary, problem, fund usage, background, call to action
- [ ] Social links ready (project site, GitHub, Twitter/X, Discord)
- [ ] Platform fee configured (or explicitly set to 0)

## Deployment
- [ ] Contract built: `cargo build --release --target wasm32-unknown-unknown`
- [ ] Contract deployed via `scripts/deploy.sh`
- [ ] Contract ID saved
- [ ] Registry ID saved
- [ ] Frontend `.env.local` updated with Contract ID and Registry ID
- [ ] `get_stats` called to verify deployment — `total_raised` is 0

## Go Live
- [ ] Campaign page loads correctly at your frontend URL
- [ ] Campaign title and description appear as expected
- [ ] Contribute button is enabled (wallet connected, correct network)
- [ ] Test contribution made with a small amount and confirmed on-chain
- [ ] Announcement drafted for primary social channels
- [ ] Early supporters notified privately before public announcement

## Post-Launch
- [ ] Announcement posted to all channels
- [ ] Campaign link shared on Twitter/X, Discord, Telegram, etc.
- [ ] First progress update scheduled for day 7
- [ ] Reminder set for 3 days before deadline
- [ ] Reminder set for 24 hours before deadline
```

---

## Related Docs

- [Contract API Reference](./contract-api.md)
- [Deployment Guide](./deployment.md)
- [Frontend Integration](./frontend-integration.md)
- [Troubleshooting](./troubleshooting.md)
- [Refund Model](./refund-model.md)
