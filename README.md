# Joanna's Little Helper (JLH)

A Microsoft Word Task Pane Add-in built with TypeScript.

This project is a controlled experimental add-in designed to:
- Provide a structured, user-friendly interface in Word
- Process document content
- Integrate with external AI services (future phase)
- Maintain strict architectural separation between UI, domain logic, and integrations

---

## Architecture

The project follows a layered structure:

src/
- domain/          → Pure business logic (no Office.js, no DOM)
- app/             → Application use cases (orchestration layer)
- integrations/
    - word/        → Office.js wrappers
    - api/         → Backend / AI service calls (future)
- ui/              → UI wiring (DOM / future React components)
- taskpane/        → Office entry point (bootstrapping only)
- commands/        → Ribbon command entry points

tests/
- documents/       → .docx fixture files for integration tests
- *.test.ts        → All test files (unit and integration)

### Design Principles

- Separation of concerns
- Testable domain logic
- Replaceable integrations
- Minimal coupling to Office.js
- Secure external service usage (no secrets in client)

---

## Development Setup

Prerequisites:
- Node.js (LTS)
- Microsoft Word (Desktop)
- Office Add-in dev certificates

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev-server
```

Then launch Word with the add-in loaded:

```bash
npm start
```

---

## Known Technical Issues

### Task Pane Goes Blank When Undocked

**Symptom:** If the JLH task pane is dragged out of its docked position in Word (torn off / undocked), the pane becomes a blank white surface with no UI.

**Root cause:** This is a Word/WebView2 platform-level bug — not specific to JLH. When the pane is undocked, WebView2 loses its render surface. JavaScript events do not fire at that moment, so the issue cannot be detected or recovered from within the add-in code. Microsoft is aware of this (tracked in [OfficeDev/office-js#6479](https://github.com/OfficeDev/office-js/issues/6479), status: backlog as of early 2026).

**Workaround:** Click the **Joanna's Little Helper** button in the Word ribbon (Home tab). This reloads the task pane and restores the UI in one click.

**Primary usage mode:** JLH is designed to be used **docked**. The pane can be resized by dragging its left or bottom edge.

**If the blank screen occurs frequently**, try the following in order:
1. Update Microsoft Office to the latest channel release
2. Repair the WebView2 Runtime (via Windows Apps & Features)
3. Disable hardware graphics acceleration in Office (File → Options → Advanced → Display)
