#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const INDEX_URL = 'https://raw.githubusercontent.com/bnb-chain/skills-hub/main/skills/index.json';

// ── Helpers ────────────────────────────────────────────────────────────────

const ALLOWED_SKILL_HOST = 'raw.githubusercontent.com';

const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

function assertSafeSlug(slug) {
  if (!SAFE_SLUG_RE.test(slug)) {
    throw new Error(
      `Skill slug "${slug}" contains invalid characters. ` +
      `Only lowercase letters, numbers, and hyphens are allowed.`
    );
  }
}

function assertSafeWritePath(dest, base) {
  const resolvedDest = path.resolve(dest);
  const resolvedBase = path.resolve(base);
  if (!resolvedDest.startsWith(resolvedBase + path.sep)) {
    throw new Error(`Path traversal detected: "${dest}" escapes the skills directory.`);
  }
}

function assertSafeSkillUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch {
    throw new Error(`Invalid skill_url: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`skill_url must use HTTPS: ${url}`);
  }
  if (parsed.hostname !== ALLOWED_SKILL_HOST) {
    throw new Error(
      `skill_url host "${parsed.hostname}" is not allowed. ` +
      `Only ${ALLOWED_SKILL_HOST} is permitted.`
    );
  }
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'error' });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function fetchIndex() {
  const text = await fetchText(INDEX_URL);
  return JSON.parse(text);
}

function riskBadge(level) {
  const badges = { safe: '🟢', low: '🟡', medium: '🟠', high: '🔴' };
  return badges[level] ?? '⚪';
}

function installDir(global) {
  return global
    ? path.join(os.homedir(), '.claude', 'skills')
    : path.join(process.cwd(), '.claude', 'skills');
}

// ── Commands ───────────────────────────────────────────────────────────────

async function cmdAdd(slug, opts) {
  if (!slug) {
    console.error('Usage: skills-hub add <skill-slug>');
    process.exit(1);
  }

  console.log(`Fetching skills index…`);
  const index = await fetchIndex();

  const skill = index.skills.find(
    s => s.slug === slug || s.name.toLowerCase() === slug.toLowerCase()
  );

  if (!skill) {
    console.error(`Skill "${slug}" not found in the registry.`);
    console.error(`Run \`skills-hub list\` to see available skills.`);
    process.exit(1);
  }

  // AgentGuard safety gate
  if (skill.risk_level === 'high') {
    console.error(`\n🔴 Blocked: "${skill.name}" has a HIGH risk score (${skill.risk_score}).`);
    console.error(`Review the AgentGuard report before proceeding:`);
    console.error(`  ${skill.agentguard_report_url ?? '(no report available)'}`);
    process.exit(1);
  }
  if (skill.risk_level === 'medium') {
    console.warn(`\n🟠 Warning: "${skill.name}" has a MEDIUM risk score (${skill.risk_score}).`);
    console.warn(`AgentGuard report: ${skill.agentguard_report_url ?? '(unavailable)'}`);
    console.warn(`Proceeding — review the report before use.\n`);
  }

  if (!skill.skill_url) {
    console.error(`Skill "${skill.name}" does not expose a direct install URL.`);
    console.error(`Visit the skill repository to install manually: ${skill.github_url}`);
    process.exit(1);
  }

  try {
    assertSafeSlug(skill.slug);
    assertSafeSkillUrl(skill.skill_url);
  } catch (err) {
    console.error(`\n🔴 Blocked: ${err.message}`);
    process.exit(1);
  }

  console.log(`Downloading ${skill.name} (${riskBadge(skill.risk_level)} ${skill.risk_level ?? 'unscanned'})…`);
  const content = await fetchText(skill.skill_url);

  const dir = installDir(opts.global);
  fs.mkdirSync(dir, { recursive: true });

  const dest = path.join(dir, `${skill.slug}.md`);
  try {
    assertSafeWritePath(dest, dir);
  } catch (err) {
    console.error(`\n🔴 Blocked: ${err.message}`);
    process.exit(1);
  }

  fs.writeFileSync(dest, content, 'utf8');

  console.log(`\n✅ Installed: ${dest}`);
  console.log(`   Invoke with: /${skill.slug}`);
  if (skill.agentguard_report_url) {
    console.log(`   AgentGuard:  ${skill.agentguard_report_url}`);
  }
}

async function cmdList() {
  console.log('Fetching skills index…\n');
  const index = await fetchIndex();

  if (!index.skills.length) {
    console.log('No skills in the registry yet.');
    return;
  }

  const nameW = Math.max(4, ...index.skills.map(s => s.name.length));
  const catW  = Math.max(8, ...index.skills.map(s => s.category.join(', ').length));

  console.log(
    'Name'.padEnd(nameW) + '  ' +
    'Category'.padEnd(catW) + '  ' +
    'Risk   ' +
    'Slug'
  );
  console.log('-'.repeat(nameW + catW + 24));

  for (const s of index.skills) {
    const risk = `${riskBadge(s.risk_level)} ${(s.risk_level ?? 'unknown').padEnd(6)}`;
    console.log(
      s.name.padEnd(nameW) + '  ' +
      s.category.join(', ').padEnd(catW) + '  ' +
      risk + '  ' +
      s.slug
    );
  }

  console.log(`\n${index.skills.length} skill(s) · index generated ${index.generated_at}`);
  console.log(`Install a skill: npx skills-hub add <slug>`);
}

async function cmdSearch(query) {
  if (!query) {
    console.error('Usage: skills-hub search <query>');
    process.exit(1);
  }

  const index = await fetchIndex();
  const q = query.toLowerCase();

  const results = index.skills.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.category.some(c => c.toLowerCase().includes(q))
  );

  if (!results.length) {
    console.log(`No skills matched "${query}".`);
    return;
  }

  for (const s of results) {
    console.log(`\n${riskBadge(s.risk_level)} ${s.name}  [${s.slug}]`);
    console.log(`   ${s.description}`);
    console.log(`   Categories: ${s.category.join(', ')}`);
    console.log(`   Risk: ${s.risk_level ?? 'unscanned'} (score: ${s.risk_score ?? 'n/a'})`);
    console.log(`   Install: npx skills-hub add ${s.slug}`);
  }
}

// ── Entry point ────────────────────────────────────────────────────────────

const [,, command, arg, ...flags] = process.argv;
const opts = { global: flags.includes('--global') || flags.includes('-g') };

(async () => {
  try {
    switch (command) {
      case 'add':    await cmdAdd(arg, opts);   break;
      case 'list':   await cmdList();            break;
      case 'search': await cmdSearch(arg);       break;
      default:
        console.log('BNBChain Skills Hub\n');
        console.log('Usage:');
        console.log('  npx skills-hub list              List all available skills');
        console.log('  npx skills-hub search <query>    Search skills by keyword or category');
        console.log('  npx skills-hub add <slug>        Install a skill to .claude/skills/');
        console.log('  npx skills-hub add <slug> -g     Install globally to ~/.claude/skills/');
        console.log('\nGet started: npx skills-hub add skills-hub');
        break;
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
})();
