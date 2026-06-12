#!/usr/bin/env node
/**
 * scripts/build.mjs — Package the Chrome extension into a .zip for distribution
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
const MANIFEST = resolve(ROOT, 'manifest.json')

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'))

// Validate manifest: check all referenced files exist
const missing = []
const cs = manifest.content_scripts?.[0]
if (cs) {
  for (const f of [...(cs.js || []), ...(cs.css || [])]) {
    if (!existsSync(resolve(ROOT, f))) missing.push(f)
  }
}
for (const f of [
  ...Object.values(manifest.icons || {}),
  manifest.background?.service_worker,
  manifest.action?.default_popup,
].filter(Boolean)) {
  if (!existsSync(resolve(ROOT, f))) missing.push(f)
}
for (const entry of manifest.web_accessible_resources || []) {
  for (const r of entry.resources) {
    if (!r.includes('*') && !existsSync(resolve(ROOT, r))) missing.push(r)
  }
}
if (missing.length) {
  console.error('Manifest references missing files:')
  missing.forEach((f) => console.error(`  ${f}`))
  process.exit(1)
}

const version = manifest.version
const zipName = `yipet-v${version}.zip`
const zipPath = resolve(DIST, zipName)

if (existsSync(DIST)) rmSync(DIST, { recursive: true })
mkdirSync(DIST, { recursive: true })

const exclude = [
  'node_modules/*',
  '.git/*',
  '.claude/*',
  '.husky/_/*',
  'dist/*',
  'coverage/*',
  'test-results/*',
  '.env',
  '.DS_Store',
  '*.log',
]

const excludeArgs = exclude.map((e) => `-x "${e}"`).join(' ')
execSync(`cd "${ROOT}" && zip -r "${zipPath}" . ${excludeArgs}`, { stdio: 'inherit' })

console.log(`\nPackaged: ${zipPath}`)
