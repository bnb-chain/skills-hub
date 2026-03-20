# SH-A04: Repository Transfer Bait-and-Switch Bypasses Security Scan

## Severity
Low

## Affected Files
- `scripts/enrich-skill.js`, lines 116-120 (metadata fetch)
- `scripts/enrich-skill.js`, line 144 (AgentGuard scan)

## Description
A Time-of-Check-to-Time-of-Use (TOCTOU) inconsistency exists between the security scan and the recorded metadata. The enrichment script fetches repository metadata via the GitHub API (`repos/{owner}/{repo}`) and records `repoData.html_url` as the canonical URL. The AgentGuard security scan runs against the submitted `owner/repo` pair. However, between the scan passing and the enriched PR being merged, an attacker can transfer the clean repository to a different account and create a new repository at the original `owner/repo` path containing malicious content. The recorded `html_url` in the merged metadata would then point to the transferred (clean) repository, while the actual URL path serves attacker-controlled content.

## Vulnerable Code
```javascript
// Lines 116-120: Metadata fetch records html_url
const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
const repoData = await repoRes.json();
// repoData.html_url is recorded in enriched metadata

// Line 144: Security scan runs on owner/repo
const scanResult = await scanWithAgentGuard(owner, repo, repoContent);
// Scan passes on clean content at owner/repo
```

After scan passes:
1. Attacker transfers clean repo away (URL redirect maintained by GitHub)
2. Attacker creates new repo at same `owner/repo` with malicious content
3. Merged metadata `html_url` now resolves to transferred clean repo
4. But anyone navigating to `github.com/owner/repo` sees malicious content

## Proof of Concept
1. Submit skill with `attacker/clean-skill` repository containing legitimate code
2. Enrichment runs: AgentGuard scans clean code, scan passes
3. Before PR merge: attacker transfers `clean-skill` to `attacker-alt` account
4. Attacker creates new `attacker/clean-skill` repository with malicious content
5. Merged skill metadata appears legitimate but the repository URL now serves malicious code

## Recommended Fix
After fetching repository metadata via the API, verify that the canonical URL (`repoData.html_url`) matches the expected `https://github.com/{owner}/{repo}`. Also consider:
1. Recording the repository ID (immutable) alongside the URL
2. Re-verifying repository content hash at merge time
3. Adding a post-merge webhook that re-scans on repository transfer events

## Verification
- Pass 1: TOCTOU gap confirmed between scan (line 144) and metadata recording (lines 116-120)
- Pass 2: No repository identity verification (ID or URL match) after API fetch
- Pass 3: Distinct from PR #72 (SSRF protection on URL parsing) and PR #99 (post-scan content hash — was CLOSED, not merged, so the gap remains)

Excludes all 47 existing mefai-dev PRs (#68-#114).

## Methodology
Manual source code review with data flow analysis. Triple verified.

## Researcher
Independent Security Researcher — Mefai Security Team
