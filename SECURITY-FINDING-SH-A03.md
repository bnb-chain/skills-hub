# SH-A03: Unbounded Remote Content Fetch Enables CI Runner OOM Denial of Service

## Severity
Low

## Affected File
`scripts/enrich-skill.js`, lines 91-98

## Description
The `fetchRepoContent` function fetches up to 5 markdown files from the submitted repository with no size limit on the response body. An attacker can create a repository containing extremely large markdown files (e.g., 500MB each), exhausting the CI runner memory (typically 7GB for GitHub-hosted runners). The fetched content is accumulated in memory via `Promise.all`, concatenated, and then sent as a single JSON payload to the AgentGuard API, compounding the memory pressure.

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

No `Content-Length` check, no streaming size limit, no per-file cap. Five files of 500MB each would require 2.5GB+ of memory just for the raw text, plus additional memory for string concatenation and JSON serialization.

## Proof of Concept
1. Create a repository with 5 markdown files, each ~500MB (e.g., repeated text)
2. Submit skill metadata pointing to this repository
3. Enrichment workflow triggers, `fetchRepoContent` begins fetching all 5 files
4. CI runner memory exhausted, workflow crashes with OOM
5. Repeated submissions can persistently deny enrichment processing for legitimate skills

## Recommended Fix
Add a `MAX_FILE_SIZE` constant (e.g., 1MB) and enforce it:
1. Check `Content-Length` header before reading the response body
2. Use a streaming reader with a byte counter that aborts if the limit is exceeded
3. Consider also limiting the total combined content size sent to AgentGuard

```javascript
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const raw = await fetch(url);
const contentLength = parseInt(raw.headers.get('content-length') || '0', 10);
if (contentLength > MAX_FILE_SIZE) return null;
// Also enforce during streaming for cases where Content-Length is absent
```

## Verification
- Pass 1: No size checks on fetch response in fetchRepoContent (lines 91-98)
- Pass 2: Promise.all accumulates all content in memory simultaneously
- Pass 3: Distinct from PR #80 (submission JSON schema size validation, not fetch response size) and PR #78 (HTTP request timeouts, not response body size limits)

Excludes all 47 existing mefai-dev PRs (#68-#114).

## Methodology
Manual source code review with data flow analysis. Triple verified.

## Researcher
Independent Security Researcher — Mefai Security Team
