# SH-A01: Git Tree Path Traversal Enables Cross-Repository Content Exfiltration

## Severity
Medium

## Affected File
`scripts/enrich-skill.js`, lines 91-97

## Description
The `f.path` value from the GitHub Git Trees API response is used without validation in the `raw.githubusercontent.com` URL construction. An attacker controlling a submitted repository can craft git tree entries with path-traversal sequences (e.g., `../../other-owner/other-repo/main/sensitive-file.md`), causing the enrichment script to fetch content from unrelated repositories. This enables cross-repository content exfiltration via the AgentGuard scan payload and false-positive manipulation.

## Vulnerable Code
```javascript
const contents = await Promise.all(
  candidates.map(async (f) => {
    const raw = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${f.path}`
    );
    return raw.ok ? `### ${f.path}\n${await raw.text()}` : null;
  })
);
```

## Proof of Concept
1. Create repository with git tree containing blob path `../../bnb-chain/bnb-chain.github.io/main/README.md`
2. Submit skill metadata pointing to this repository
3. Enrichment script constructs URL resolving to content from bnb-chain/bnb-chain.github.io
4. Content from unrelated repository is sent to AgentGuard

## Recommended Fix
Add path validation rejecting `..` sequences, absolute paths, and URL-encoded traversal. Encode each path segment with encodeURIComponent.

## Verification
- Pass 1: f.path used unsanitized from API response (line 94)
- Pass 2: No path validation in candidates filter (lines 81-87) — only checks .endsWith('.md')
- Pass 3: Distinct from PR #73 (encodes owner/repo) and PR #74 (protects local paths, not remote URLs)

Excludes all 47 existing mefai-dev PRs (#68-#114).

## Methodology
Manual source code review with data flow analysis. Triple verified.

## Researcher
Independent Security Researcher — Mefai Security Team
