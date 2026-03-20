# SH-A06: Enrichment Silently Drops Contributor-Defined Extra Fields

## Severity
Informational

## Affected File
`scripts/enrich-skill.js`, lines 186-209

## Description
The enrichment process builds a new JSON object from scratch using only the 4 required fields extracted by `parseSubmission` (name, github_url, category, description) plus the enrichment-generated fields (stars, forks, license, topics, etc.). Any additional fields provided by the skill contributor in their original metadata submission — such as `version`, `tags`, `documentation_url`, `author`, `dependencies`, or custom metadata — are silently discarded during enrichment. There is no warning, error, or documentation indicating this behavior.

## Vulnerable Code
```javascript
// parseSubmission extracts only 4 fields (lines ~50-70)
function parseSubmission(content) {
  return {
    name: ...,
    github_url: ...,
    category: ...,
    description: ...
  };
}

// Enrichment builds new object, discarding everything else (lines 186-209)
const enrichedSkill = {
  name: submission.name,
  github_url: submission.github_url,
  category: submission.category,
  description: submission.description,
  // ... only enrichment-generated fields added below
  stars: repoData.stargazers_count,
  forks: repoData.forks_count,
  // etc.
};
```

## Impact
- Contributors lose metadata they intentionally included in their submission
- No feedback mechanism informs contributors their fields were dropped
- Potential data integrity issues if downstream consumers expect these fields
- Discourages contributors from providing rich metadata since it gets discarded

## Proof of Concept
1. Submit skill metadata with extra fields:
   ```json
   {
     "name": "My Skill",
     "github_url": "https://github.com/owner/repo",
     "category": "defi",
     "description": "A DeFi skill",
     "version": "2.1.0",
     "tags": ["swap", "liquidity"],
     "documentation_url": "https://docs.example.com",
     "author": "contributor-name"
   }
   ```
2. Enrichment runs successfully
3. Enriched metadata in the generated PR contains only the 4 required fields plus auto-generated enrichment data
4. `version`, `tags`, `documentation_url`, and `author` are silently lost

## Recommended Fix
Merge contributor-provided extra fields into the enriched object, preserving any fields beyond the 4 required ones:

```javascript
const enrichedSkill = {
  ...submission,           // Preserve all contributor fields
  // Enrichment fields override/supplement:
  stars: repoData.stargazers_count,
  forks: repoData.forks_count,
  // etc.
};
```

Alternatively, if field restriction is intentional, document this behavior explicitly in `CONTRIBUTING.md` so contributors know only the 4 required fields are retained.

## Verification
- Pass 1: `parseSubmission` confirmed to extract only 4 fields (name, github_url, category, description)
- Pass 2: Enriched object construction (lines 186-209) does not reference or merge original submission beyond those 4 fields
- Pass 3: No documentation in CONTRIBUTING.md or README.md mentions this field-dropping behavior

Excludes all 47 existing mefai-dev PRs (#68-#114).

## Methodology
Manual source code review with data flow analysis. Triple verified.

## Researcher
Independent Security Researcher — Mefai Security Team
