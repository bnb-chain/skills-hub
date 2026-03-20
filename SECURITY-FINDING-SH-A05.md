# SH-A05: Multi-Commit Push Causes Partial Enrichment Skip

## Severity
Informational

## Affected File
`.github/workflows/enrich-skill.yml`, line 56

## Description
The enrichment workflow uses `git diff HEAD~1 HEAD` to detect which skill metadata files were added or modified in a push event. This only compares the last commit against its parent, meaning that in a multi-commit push (e.g., a force-push with rebased commits, or a merge commit from a feature branch), skill metadata changes introduced in earlier commits may not appear in the final commit's diff. This causes the enrichment process to silently skip those skills.

## Vulnerable Code
```yaml
# Line 56 in enrich-skill.yml
run: |
  git diff HEAD~1 HEAD --name-only --diff-filter=AM
```

This only captures files changed between the last commit and its immediate parent. In a push containing commits A, B, C where skill metadata was added in commit A but not modified in C, the diff between B and C will not include the skill file.

## Proof of Concept
1. Create a feature branch with 3 commits:
   - Commit 1: Add `skills/new-skill/metadata.json`
   - Commit 2: Update `README.md`
   - Commit 3: Update `CONTRIBUTING.md`
2. Push the branch and merge to main (or push directly with all 3 commits)
3. Workflow triggers on the push event
4. `git diff HEAD~1 HEAD` only shows changes from Commit 3 (CONTRIBUTING.md)
5. `skills/new-skill/metadata.json` from Commit 1 is never detected
6. Skill is never enriched despite being successfully merged

## Recommended Fix
Use `github.event.before` (the previous HEAD before the push) instead of `HEAD~1`:

```yaml
run: |
  git diff ${{ github.event.before }} ${{ github.sha }} --name-only --diff-filter=AM
```

This captures all changes across all commits in the push, regardless of how many commits are included.

## Verification
- Pass 1: `HEAD~1` confirmed on line 56, only captures single-commit diff
- Pass 2: No fallback mechanism to detect missed skills from earlier commits
- Pass 3: Distinct from PR #101 (merge commit diff bypass — was CLOSED, not merged, so this gap remains open)

Excludes all 47 existing mefai-dev PRs (#68-#114).

## Methodology
Manual source code review with data flow analysis. Triple verified.

## Researcher
Independent Security Researcher — Mefai Security Team
