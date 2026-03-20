# SH-A02: Unpinned GitHub Actions Enable Supply Chain Compromise

## Severity
Low

## Affected Files
- `.github/workflows/enrich-skill.yml`, lines 27, 35, 133
- `.github/workflows/scope-guard.yml`, lines 20, 72

## Description
All 5 GitHub Actions references across both workflow files use mutable version tags (`@v4`, `@v7`) instead of SHA-pinned digests. If an upstream action maintainer account is compromised or a tag is force-pushed to a malicious commit, arbitrary code executes within the repository CI environment. The workflows run with `contents: write` and `pull-requests: write` permissions and have access to the `AGENTGUARD_API_KEY` secret, meaning a compromised action could exfiltrate secrets, modify repository content, or tamper with pull requests.

## Vulnerable Code
```yaml
# enrich-skill.yml
- uses: actions/checkout@v4          # line 27
- uses: actions/setup-node@v4        # line 35
- uses: peter-evans/create-pull-request@v7  # line 133

# scope-guard.yml
- uses: actions/checkout@v4          # line 20
- uses: actions/github-script@v7     # line 72
```

## Proof of Concept
1. Upstream action maintainer account is compromised (or maintainer acts maliciously)
2. Attacker force-pushes the `v4` tag to point to a commit containing malicious code
3. Next workflow run pulls the malicious version
4. Malicious code executes with `contents: write`, `pull-requests: write` permissions
5. `AGENTGUARD_API_KEY` secret is exfiltrated via the compromised action

## Recommended Fix
Pin all actions to their full SHA-256 commit digest with a version comment for maintainability:

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
- uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8  # v4.0.2
- uses: peter-evans/create-pull-request@153407881ec5c347639a548ade7d8ad1d6740e38  # v7.0.5
- uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea  # v7.0.1
```

## Verification
- Pass 1: All 5 action references confirmed using mutable tags
- Pass 2: Both workflows have elevated permissions (contents:write, pull-requests:write)
- Pass 3: Distinct from PR #86 (permissions hardening addresses GITHUB_TOKEN scope, not action pinning)

Excludes all 47 existing mefai-dev PRs (#68-#114).

## Methodology
Manual source code review with data flow analysis. Triple verified.

## Researcher
Independent Security Researcher — Mefai Security Team
