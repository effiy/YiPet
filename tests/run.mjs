#!/usr/bin/env node

/**
 * YiPet Self-Test Runner — runs vitest and writes test center compatible results.json.
 *
 * Usage:
 *   node tests/run.mjs                # Run all tests, write tests/results.json
 *   node tests/run.mjs --list         # List test files without running
 *   node tests/run.mjs --text         # Text output only, no results.json
 *   node tests/run.mjs --unit         # Run only unit tests
 *   node tests/run.mjs --integration  # Run only integration tests
 *   node tests/run.mjs --modules      # Run only module tests
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const TESTS_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(TESTS_DIR, '..')
const RESULTS_PATH = resolve(TESTS_DIR, 'results.json')
const MANIFEST_PATH = resolve(TESTS_DIR, 'manifest.json')

const CATEGORY_MAP = {
  unit: ['token.test.mjs', 'api.test.mjs', 'request.test.mjs', 'storage.test.mjs', 'config.test.mjs', 'error.test.mjs'],
  integration: ['pipeline.test.mjs'],
  modules: ['ChatWindow.test.mjs', 'sw.test.mjs'],
}

function loadManifestNames() {
  try {
    if (!existsSync(MANIFEST_PATH)) return {}
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
    const names = {}
    for (const f of manifest.files || []) {
      if (f.name && f.name.endsWith('.test.mjs') && f.desc) {
        names[f.name] = f.desc
      }
    }
    return names
  } catch {
    return {}
  }
}

function parseArgs() {
  const args = process.argv.slice(2)
  const filters = []
  let listOnly = false,
    textOnly = false

  for (const arg of args) {
    if (arg === '--unit') filters.push('unit')
    else if (arg === '--integration') filters.push('integration')
    else if (arg === '--modules') filters.push('modules')
    else if (arg === '--list') listOnly = true
    else if (arg === '--text') textOnly = true
  }

  if (filters.length === 0) filters.push(...Object.keys(CATEGORY_MAP))
  return { filters, listOnly, textOnly }
}

function getTestFiles(filters) {
  const files = new Set()
  for (const filter of filters) {
    for (const f of CATEGORY_MAP[filter] || []) {
      files.add(f)
    }
  }
  return [...files].sort()
}

function extractJson(stdout) {
  const jsonStart = stdout.indexOf('{')
  if (jsonStart < 0) return null
  try {
    return JSON.parse(stdout.slice(jsonStart))
  } catch {
    return null
  }
}

function transformResults(vitestResult) {
  const manifestNames = loadManifestNames()
  const suites = []
  let totalTests = 0,
    totalPassed = 0,
    totalFailed = 0,
    totalSkipped = 0

  for (const fileResult of vitestResult.testResults || []) {
    const fileName = fileResult.name.split('/').pop()
    const displayName = manifestNames[fileName] || fileName
    if (!displayName) continue

    const tests = []
    for (const t of fileResult.assertionResults || []) {
      const ancestors = t.ancestorTitles || []
      const fullName = ancestors.length > 0 ? `${ancestors.join(' › ')} › ${t.title}` : t.title

      const entry = { name: fullName, status: t.status, duration: t.duration }
      if (t.failureMessages && t.failureMessages.length > 0) {
        entry.error = t.failureMessages[0]
      }
      tests.push(entry)
    }

    totalTests += tests.length
    totalPassed += tests.filter((t) => t.status === 'passed').length
    totalFailed += tests.filter((t) => t.status === 'failed').length
    totalSkipped += tests.filter((t) => t.status === 'skipped' || t.status === 'pending').length

    suites.push({ name: displayName, tests })
  }

  return {
    timestamp: new Date().toISOString(),
    files: suites.length,
    durationMs: vitestResult.startTime ? Date.now() - vitestResult.startTime : 0,
    summary: {
      total: totalTests,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
    },
    suites,
  }
}

function main() {
  const { filters, listOnly, textOnly } = parseArgs()

  const testFiles = getTestFiles(filters)

  if (listOnly) {
    const manifestNames = loadManifestNames()
    for (const file of testFiles) {
      console.log(`  tests/**/${file}  — ${manifestNames[file] || file}`)
    }
    console.log(`\n${testFiles.length} test file(s)`)
    return 0
  }

  const result = spawnSync('npx', ['vitest', 'run', '--reporter=json', '--no-color'], {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: 60_000,
  })

  const stdout = (result.stdout || '').trim()
  const vitestResult = extractJson(stdout)

  if (!vitestResult) {
    console.error('Failed to parse vitest JSON output.')
    if (result.stderr) console.error(result.stderr)
    return 1
  }

  const merged = transformResults(vitestResult)

  if (!textOnly) {
    writeFileSync(RESULTS_PATH, JSON.stringify(merged, null, 2), 'utf-8')
    console.log(JSON.stringify(merged))
  } else {
    console.log(`Files: ${merged.files}`)
    console.log(
      `Total: ${merged.summary.total} | Passed: ${merged.summary.passed} | Failed: ${merged.summary.failed} | Skipped: ${merged.summary.skipped}`,
    )
    for (const s of merged.suites) {
      const status = s.tests.every((t) => t.status === 'passed') ? '✓' : '✗'
      console.log(`  ${status} ${s.name}`)
    }
  }

  return merged.summary.failed > 0 ? 1 : 0
}

process.exit(main())
