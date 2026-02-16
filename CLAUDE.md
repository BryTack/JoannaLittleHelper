# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Joanna's Little Helper (JLH) — a Microsoft Word Task Pane Add-in built with TypeScript, Webpack 5, and Babel. Targets Word Desktop with ReadWriteDocument permissions. Dev server runs on localhost:3000 with HTTPS.

## Commands

```bash
npm install                # Install dependencies
npm run dev-server         # Start webpack dev server (localhost:3000, HTTPS)
npm run build              # Production build (dist/)
npm run build:dev          # Development build
npm run watch              # Watch mode
npm run lint               # Lint (office-addin-lint)
npm run lint:fix           # Auto-fix lint issues
npm run prettier           # Format code
npm run validate           # Validate manifest.xml
npm start                  # Start Office Add-in debugging (Word Desktop)
npm stop                   # Stop debugging
```

npm test                   # Run Jest tests
npm test -- --watch        # Watch mode
npm test -- src/domain/messages.test.ts  # Single test file

## Architecture

Strict 4-layer architecture with one-way dependency flow:

```
UI → App → Domain
         → Integrations
```

| Layer | Path | Responsibility |
|-------|------|---------------|
| **Domain** | `src/domain/` | Pure business logic. No Office.js, no DOM, no side effects. |
| **App** | `src/app/` | Use-case orchestration. Calls domain + integrations. |
| **Integrations** | `src/integrations/word/` | Office.js wrappers (Word API). `src/integrations/api/` reserved for future backend/AI calls. |
| **UI** | `src/ui/` | DOM event wiring. Finds elements by ID, attaches listeners. |

Entry points (bootstrap only, no logic):
- `src/taskpane/taskpane.ts` — `Office.onReady()` init, wires UI
- `src/commands/commands.ts` — Ribbon command handlers

### Key constraints
- Domain must never import from integrations, UI, or Office.js
- All Office.js calls go through `integrations/word/wordClient.ts` using `Word.run()` context
- UI layer disables buttons during async operations and restores state in `finally` blocks
- No secrets in client code; external API calls go through the integrations/api layer

## Build & Config

- **Webpack** bundles two entry points: `taskpane` and `commands`
- **Babel** transpiles TypeScript (not tsc) with `@babel/preset-typescript`
- **TypeScript** (`tsconfig.json`): target ES2017, JSX React, strict source maps
- **Browser targets**: `last 2 versions, not ie 11`
- **Testing**: Jest with ts-jest; test files co-located as `*.test.ts`
- **ESLint**: `eslint-plugin-office-addins` with recommended rules
- **Prettier**: uses `office-addin-prettier-config`
- **Manifest**: `manifest.xml` at project root, validated via `npm run validate`

## Styling

Uses Microsoft Fluent UI (Office UI Fabric) loaded from CDN (`office-ui-fabric-core` v11.1.0). Custom styles in `src/taskpane/taskpane.css` using `.ms-*` classes.
