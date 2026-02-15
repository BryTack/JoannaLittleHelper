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
