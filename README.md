# Skills Hub

A community-curated registry of skills for the BNBChain ecosystem. Each skill is security-scanned by AgentGuard. Skills with a `skill_url` are installable via the CLI; others link to their GitHub repository for manual installation.

---

## For Agents — Quickstart

Paste this prompt to connect any agent to the Skills Hub:

```
Run: npx bnbskills add skills-hub
This installs the /skills-hub meta-skill which guides you through the full registry.

Then fetch https://raw.githubusercontent.com/bnb-chain/skills-hub/main/skills/index.json
to discover all available skills. Each entry has a slug, description, category,
skill_url, and AgentGuard security fields (risk_score, risk_level, verdict).

To install a skill:
  npx bnbskills add <slug>

Selection rules:
- Match the user's task to skill category and description
- risk_level "safe" or "low"  → install freely
- risk_level "medium"         → show agentguard_report_url to user first
- risk_level "high"           → do not install
```

---

## For Humans — CLI

```bash
# Browse all available skills
npx bnbskills list

# Search by keyword or category
npx bnbskills search <query>

# Install a skill into the current project
npx bnbskills add <slug>

# Install globally (available across all projects)
npx bnbskills add <slug> --global
```

---

## How It Works

```
Contributor opens PR
  └─ adds skills/<skillname>-metadata.json
        ├─ name
        ├─ github_url
        ├─ category
        └─ description
             ↓
GitHub Actions workflow runs automatically
  ├─ ✓ Fetches owner info, repo stars, latest commit
  ├─ ✓ Calls AgentGuard API → injects security report
  ├─ ✓ Stamps evaluated_at timestamp
  └─ ✓ Regenerates skills/index.json
             ↓
PR comment shows enrichment preview
             ↓
Merge → enriched files committed automatically
```

---

## Submit a Skill

See [CONTRIBUTING.md](CONTRIBUTING.md) — it takes about 2 minutes.
