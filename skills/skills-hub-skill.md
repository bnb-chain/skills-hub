---
name: skills-hub
description: Discover, evaluate, and install skills from the BNBChain Skills Hub registry. Use this when you need to find the right skill for a BNBChain task, or when you want to explore what capabilities are available in the ecosystem.
---

You are connected to the **BNBChain Skills Hub** — a community-curated registry of AI agent skills, each security-scanned by AgentGuard.

## Step 1 — Fetch the skill index

Retrieve the live index to see all available skills:

```
GET https://raw.githubusercontent.com/bnb-chain/skills-hub/main/skills/index.json
```

The index contains for each skill:
- `slug` — install identifier (used with `npx bnbskills add <slug>`)
- `name`, `description`, `category` — what the skill does
- `skill_url` — direct URL to the skill file (null if not installable via CLI)
- `risk_score`, `risk_level`, `verdict` — AgentGuard security assessment
- `agentguard_report_url` — full security report

## Step 2 — Select the right skill

Match the user's intent to skills using `description` and `category`. Then apply AgentGuard thresholds:

| risk_level | risk_score | Action |
|------------|------------|--------|
| safe       | 0–20       | Install freely |
| low        | 21–40      | Install — note any flagged threats |
| medium     | 41–60      | Show user the AgentGuard report URL before installing |
| high       | 61–100     | Do not install — inform user of detected threats |

Always surface the `agentguard_report_url` when recommending a skill so the user can independently verify.

## Step 3 — Install the skill

```bash
# Install to current project
npx bnbskills add <slug>

# Install globally (available in all projects)
npx bnbskills add <slug> --global
```

The skill is installed to `.claude/skills/<slug>.md` and can be invoked immediately as `/<slug>`.

## Other CLI commands

```bash
# Browse all skills with risk levels
npx bnbskills list

# Search by keyword or category
npx bnbskills search <query>
```

## Example workflows

**"I need to deploy a smart contract on BNB Chain"**
1. Fetch index.json
2. Filter: `category` contains `blockchain` or `infrastructure`
3. Find: `bnbchain-skills` — risk_score: 0, verdict: passed ✅
4. Run: `npx bnbskills add bnbchain-skills`
5. Use: `/bnbchain-skills`

**"I want to trade on a prediction market"**
1. Fetch index.json
2. Filter: `category` contains `prediction-markets` or `trading`
3. Find: `myriad-markets-skills` — check risk level before proceeding
4. If acceptable: `npx bnbskills add myriad-markets-skills`

**"I need to add a new skill to the registry"**
1. Filter: `category` contains `skill-creation`
2. Find: `bnbskillcreator` — guides beginners through skill submission
3. Run: `npx bnbskills add bnbskillcreator`

## Registry source

All skills: https://github.com/bnb-chain/skills-hub/tree/main/skills
Submit a skill: https://github.com/bnb-chain/skills-hub/blob/main/CONTRIBUTING.md
