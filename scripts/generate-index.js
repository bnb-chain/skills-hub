#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const INDEX_PATH = path.join(SKILLS_DIR, 'index.json');

const files = fs.readdirSync(SKILLS_DIR)
  .filter(f => f.endsWith('-metadata.json') && !f.startsWith('_'));

const skills = files.map(file => {
  const slug = file.replace('-metadata.json', '');
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, file), 'utf8'));
  } catch (err) {
    console.error(`Skipping ${file}: ${err.message}`);
    return null;
  }
  return {
    slug,
    name:                raw.name        ?? slug,
    description:         raw.description ?? '',
    category:            raw.category    ?? [],
    github_url:          raw.github_url  ?? '',
    skill_url:           raw.skill_url   ?? null,
    owner:               raw.owner?.username ?? null,
    risk_score:          raw.agentguard_result?.risk_score  ?? null,
    risk_level:          raw.agentguard_result?.risk_level  ?? null,
    verdict:             raw.agentguard_result?.verdict     ?? null,
    agentguard_report_url: raw.agentguard_report_url ?? null,
    evaluated_at:        raw.evaluated_at ?? null,
  };
}).filter(Boolean);

const index = {
  generated_at: new Date().toISOString(),
  source:       'https://github.com/bnb-chain/skills-hub',
  skills,
};

fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
console.log(`Generated index with ${skills.length} skill(s) → skills/index.json`);
