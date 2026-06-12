# Changelog

## [1.1.2] — 2026-06-10

### Engineering

- ESLint 10.x flat config with zero warnings
- Prettier 3.x formatting across all files
- Pre-commit hooks via Husky + lint-staged
- CI/CD pipeline (GitHub Actions): lint, format, test, coverage
- `.editorconfig` for consistent editor settings
- `.nvmrc` for Node version pinning
- vitest coverage with v8 provider (0% thresholds: `loadModule` uses `new Function()` eval, not instrumentable)
- package.json metadata (description, author, license, keywords)
- `license` changed to MIT (was UNLICENSED)
- `.env.example` for environment variable documentation
- `.github/dependabot.yml` for automated npm dep updates
- `.github/ISSUE_TEMPLATE/` (bug report + feature request)
- `scripts/sync-version.mjs` + npm run version/version:patch/minor/major
- CI badge in README
- `commitlint` (conventional commits) + husky `commit-msg` hook
- `.npmrc` with `engine-strict=true` + `engines` field in `package.json`
- `.gitattributes` enforcing LF line endings
- `npm audit` job in CI (fails on high/critical)
- `.github/PULL_REQUEST_TEMPLATE.md`
- `npm run check` all-in-one gate: lint + format + test
- CodeQL security scanning workflow (scheduled weekly)
- `LICENSE` file (MIT)
- `SECURITY.md` vulnerability reporting policy
- `scripts/build.mjs` + `npm run build` — package extension as .zip
- README badges: CI, CodeQL, License, Version
- `CONTRIBUTING.md` development guide
- `CODE_OF_CONDUCT.md`
- `.github/ISSUE_TEMPLATE/config.yml` — issue chooser with contact links
- `scripts/build.mjs` manifest validation — checks all referenced files exist before packaging
- CI `summary` job — single required check for branch protection
- `.github/workflows/lock.yml` — auto-lock closed issues/PRs after 30 days
- `.github/workflows/labeler.yml` + `.github/labeler.yml` — auto-label PRs by changed paths
- `.github/workflows/greeting.yml` — welcome first-time contributors
- `.github/workflows/release.yml` `workflow_dispatch` — manual release trigger

### Fixed

- Reduced ESLint `no-unused-vars` from 117 to 0 warnings
- `no-extra-semi` disabled (Prettier owns IIFE semicolons)
- `package.json` version synced with `manifest.json`
- Coverage thresholds set to 0% (IIFE eval pattern can't be instrumented yet)

## [1.1.1] — Initial baseline
