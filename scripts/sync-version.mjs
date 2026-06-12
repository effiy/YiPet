#!/usr/bin/env node
/**
 * scripts/sync-version.mjs — 同步 manifest.json 与 package.json 版本号
 *
 * npm run version 1.2.0  — set both to 1.2.0
 * npm run version patch    — bump patch
 * npm run version minor    — bump minor
 * npm run version major    — bump major
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = resolve(ROOT, 'manifest.json')
const PACKAGE = resolve(ROOT, 'package.json')
const CLAUDE = resolve(ROOT, 'CLAUDE.md')
const README = resolve(ROOT, 'README.md')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function readText(path) {
  return readFileSync(path, 'utf-8')
}

function writeJson(path, obj) {
  writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`)
}

function writeText(path, text) {
  writeFileSync(path, text)
}

function bump(version, level) {
  const parts = version.split('.').map(Number)
  if (level === 'major') {
    parts[0]++
    parts[1] = 0
    parts[2] = 0
  } else if (level === 'minor') {
    parts[1]++
    parts[2] = 0
  } else {
    parts[2]++
  }
  return parts.join('.')
}

const input = process.argv[2]
if (!input) {
  console.error('Usage: node scripts/sync-version.mjs <version|patch|minor|major>')
  process.exit(1)
}

const manifest = readJson(MANIFEST)
const pkg = readJson(PACKAGE)
const current = manifest.version

const next = ['patch', 'minor', 'major'].includes(input) ? bump(current, input) : input

if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`Invalid version: ${next}`)
  process.exit(1)
}

manifest.version = next
pkg.version = next

writeJson(MANIFEST, manifest)
writeJson(PACKAGE, pkg)

// Sync CLAUDE.md version row
let claude = readText(CLAUDE)
claude = claude.replace(/^\| 版本\s+\| \d+\.\d+\.\d+/m, `| 版本   | ${next}`)
writeText(CLAUDE, claude)

// Sync README version badge
let readme = readText(README)
readme = readme.replace(/version-\d+\.\d+\.\d+/g, `version-${next}`)
writeText(README, readme)

// Auto git tag
execSync(`git tag v${next}`, { cwd: ROOT })

console.log(`${current} → ${next}  (manifest.json + package.json + CLAUDE.md + README.md + git tag v${next})`)
