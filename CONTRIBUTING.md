# Contributing

## Development Setup

```bash
node --version  # >= 25 (see .nvmrc)
npm ci
```

## Quick Check

```bash
npm run check     # lint + format + test
npm run build     # package extension as .zip
```

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commit messages must follow:

```
type(scope): description

feat(pet): add drag-and-drop reorder
fix(chat): handle empty message submission
chore(deps): bump vitest to 3.x
```

Commits are validated by commitlint on `git commit`.

## Code Style

- ESLint flat config enforces lint rules
- Prettier handles formatting (auto-fixed on commit via lint-staged)
- Vue 3 Options API for components
- IIFE modules sharing symbols via `window.*` / `globalThis.*` namespace

## Pull Requests

1. Create a branch from `main`
2. Make changes, ensure `npm run check` passes
3. Open a PR using the PR template

## Testing

```bash
npm test              # run tests
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

Tests use vitest + jsdom. Coverage is limited to `core/` (content scripts use `new Function()` eval which can't be instrumented).

## Code of Conduct

Please read [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before participating.
