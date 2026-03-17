#!/usr/bin/env node
/**
 * enrich-skill.js
 *
 * Reads a <skillname>-metadata.json file submitted by a contributor,
 * enriches it in-place with live data from GitHub and AgentGuard APIs.
 *
 * Usage:
 *   node scripts/enrich-skill.js skills/my-skill-metadata.json
 *
 * Environment variables:
 *   GITHUB_TOKEN         - GitHub personal access token (recommended to avoid rate limits)
 *   AGENTGUARD_API_KEY   - AgentGuard API key (required for security scan)
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSubmission(filePath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }

  const { name, github_url, category, description } = data;

  if (!github_url)  throw new Error('Missing required field: github_url');
  if (!category)    throw new Error('Missing required field: category');
  if (!description) throw new Error('Missing required field: description');
  if (!Array.isArray(category) || category.length === 0) {
    throw new Error('Field "category" must be a non-empty array of strings');
  }

  return { name, githubUrl: github_url, category, description };
}

function githubHeaders() {
  return {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'skills-hub-enricher',
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
}

async function githubGet(url) {
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status} for ${url}: ${body}`);
  }
  return res.json();
}

function parseOwnerRepo(githubUrl) {
  const m = githubUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
  if (!m) throw new Error(`Cannot parse owner/repo from URL: ${githubUrl}`);
  return { owner: m[1], repo: m[2] };
}

/**
 * Fetches the text content of skill-relevant files from a GitHub repo.
 * Returns a concatenated string to pass to AgentGuard as `content`.
 */
async function fetchRepoContent(owner, repo, defaultBranch) {
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    { headers: githubHeaders() }
  );

  if (!treeRes.ok) return null;
  const tree = await treeRes.json();

  const candidates = (tree.tree ?? [])
    .filter((f) => f.type === 'blob' && f.path.endsWith('.md'))
    .sort((a, b) => {
      const score = (p) => (p.match(/^[^/]+\.md$/i) ? 0 : 1);
      return score(a.path) - score(b.path);
    })
    .slice(0, 5);

  if (!candidates.length) return null;

  const contents = await Promise.all(
    candidates.map(async (f) => {
      const raw = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${f.path}`
      );
      return raw.ok ? `### ${f.path}\n${await raw.text()}` : null;
    })
  );

  return contents.filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// Main enrichment
// ---------------------------------------------------------------------------

async function enrich(submissionFilePath) {
  const absPath = path.resolve(submissionFilePath);
  const skillId = path.basename(absPath, '-metadata.json');

  console.log(`\n→ Enriching: ${skillId}`);

  // 1. Parse contributor-submitted JSON
  const { name, githubUrl, category, description } = parseSubmission(absPath);

  const { owner, repo } = parseOwnerRepo(githubUrl);

  // 2. Check URL accessibility + fetch repo metadata
  console.log(`  Checking repo accessibility: ${githubUrl}`);
  const repoData = await githubGet(`https://api.github.com/repos/${owner}/${repo}`);

  // Warn if repo is very new (potential spam), archived, or empty
  const repoAgeMs = Date.now() - new Date(repoData.created_at).getTime();
  const repoAgeDays = Math.floor(repoAgeMs / (1000 * 60 * 60 * 24));
  if (repoAgeDays < 7) {
    console.warn(`  \u26a0 WARNING: Repository is only ${repoAgeDays} day(s) old — may be spam`);
  }
  if (repoData.archived) {
    console.warn(`  \u26a0 WARNING: Repository is archived — skill may be unmaintained`);
  }
  if (repoData.size === 0) {
    throw new Error('Repository is empty (0 KB) — cannot enrich an empty repo');
  }

  // 3. Fetch owner profile (user or org)
  console.log(`  Fetching owner profile: ${owner}`);
  const ownerData = await githubGet(`https://api.github.com/users/${owner}`);

  // 4. Fetch latest commit hash
  console.log(`  Fetching latest commit hash`);
  const commits = await githubGet(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`
  );
  const latestCommit = commits[0]?.sha ?? null;

  // 5. AgentGuard security scan
  //    Endpoint: POST https://agentguard.gopluslabs.io/api/v1/scan
  //    Auth:     X-API-Key header  (secret: AGENTGUARD_API_KEY)
  //    Body:     { content: "<repo file text>" }
  //    Response: { report_url, scan_id, ... }
  let agentguardReportUrl = null;
  let agentguardScanId    = null;
  let agentguardResult    = null;

  if (process.env.AGENTGUARD_API_KEY) {
    console.log(`  Fetching repo content for AgentGuard scan`);
    const skillContent = await fetchRepoContent(owner, repo, repoData.default_branch);

    if (!skillContent) {
      console.warn('  ⚠ No scannable content found in repo — skipping AgentGuard');
    } else {
      console.log(`  Calling AgentGuard API`);
      try {
        const agRes = await fetch('https://agentguard.gopluslabs.io/api/v1/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.AGENTGUARD_API_KEY,
          },
          body: JSON.stringify({ content: skillContent }),
        });

        if (agRes.ok) {
          const agData = await agRes.json();
          const scan   = agData.data ?? {};
          agentguardReportUrl = scan.reportUrl ?? null;
          agentguardScanId    = scan.scanId    ?? null;
          agentguardResult    = {
            risk_score: scan.riskScore  ?? null,
            risk_level: scan.riskLevel  ?? null,
            verdict:    scan.verdict    ?? null,
            summary:    scan.summary    ?? null,
            threats:    scan.threats    ?? [],
          };
          console.log(`  AgentGuard report: ${agentguardReportUrl ?? 'no reportUrl in response'}`);
        } else {
          const errBody = await agRes.text();
          console.warn(`  ⚠ AgentGuard returned ${agRes.status}: ${errBody} — skipping`);
        }
      } catch (err) {
        console.warn(`  ⚠ AgentGuard call failed: ${err.message} — skipping`);
      }
    }
  } else {
    console.warn('  ⚠ AGENTGUARD_API_KEY not set — skipping security scan');
  }

  // 6. Merge enriched fields into the original submission file
  const enriched = {
    name: name ?? skillId,
    github_url: repoData.html_url,
    category,
    description,
    owner: {
      username:     ownerData.login,
      display_name: ownerData.name ?? ownerData.login,
      type:         ownerData.type,
      profile_url:  `https://github.com/${ownerData.login}`,
      avatar_url:   ownerData.avatar_url,
    },
    repo: {
      stars:          repoData.stargazers_count,
      default_branch: repoData.default_branch,
    },
    latest_commit:         latestCommit,
    agentguard_scan_id:    agentguardScanId,
    agentguard_report_url: agentguardReportUrl,
    agentguard_result:     agentguardResult,
    evaluated_at:          new Date().toISOString(),
  };

  fs.writeFileSync(absPath, JSON.stringify(enriched, null, 2) + '\n');
  console.log(`✓ Done: ${skillId}\n`);

  return enriched;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node scripts/enrich-skill.js <path-to-metadata.json> [...]');
  process.exit(1);
}

(async () => {
  let hasError = false;

  for (const filePath of args) {
    try {
      await enrich(filePath);
    } catch (err) {
      console.error(`✗ Failed [${filePath}]: ${err.message}`);
      hasError = true;
    }
  }

  process.exit(hasError ? 1 : 0);
})();
