#!/usr/bin/env node
/**
 * update-readme.js
 *
 * Scans skills/ directory and updates the Skill Directory table in README.md.
 * Should be run after enrichment to keep the README in sync.
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.resolve(__dirname, '..', 'skills');
const README_PATH = path.resolve(__dirname, '..', 'README.md');

function loadSkills() {
  return fs.readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith('-metadata.json') && f !== '_TEMPLATE-metadata.json')
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

function buildTable(skills) {
  if (!skills.length) {
    return '| *(No skills yet \u2014 [submit yours!](CONTRIBUTING.md))* | | | |';
  }

  return skills.map(s => {
    const name = s.name || 'Unknown';
    const url = s.github_url || '#';
    const cats = (s.category || []).join(', ');
    const owner = s.owner ? `[@${s.owner.username}](${s.owner.profile_url})` : 'Unknown';
    const guard = s.agentguard_report_url
      ? `[View](${s.agentguard_report_url})`
      : 'Pending';
    return `| [${name}](${url}) | ${cats} | ${owner} | ${guard} |`;
  }).join('\n');
}

const skills = loadSkills();
const table = buildTable(skills);

let readme = fs.readFileSync(README_PATH, 'utf8');

// Replace the table content between header and the next section
const tableStart = '|-------|----------|-------|------------|';
const tableEnd = '\n\n---';

const startIdx = readme.indexOf(tableStart);
if (startIdx === -1) {
  console.error('Could not find table header in README.md');
  process.exit(1);
}

const afterHeader = startIdx + tableStart.length;
const endIdx = readme.indexOf(tableEnd, afterHeader);

readme = readme.slice(0, afterHeader) + '\n' + table + readme.slice(endIdx);

fs.writeFileSync(README_PATH, readme);
console.log(`Updated README with ${skills.length} skill(s)`);
