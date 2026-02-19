# JLH — Setup Guide

This guide covers everything needed to install and run Joanna's Little Helper (JLH) from scratch.

---

## Prerequisites

| Tool | Required version | Notes |
|------|-----------------|-------|
| **Node.js** | v18 LTS or later | [nodejs.org](https://nodejs.org) |
| **npm** | Included with Node.js | |
| **Git** | Any recent version | [git-scm.com](https://git-scm.com) |
| **Microsoft Word** | Microsoft 365 Desktop | Online/web version is not supported |
| **Python 3.13** | Exactly 3.13 — see note below | [python.org](https://www.python.org/downloads/) |

> **Why Python 3.13 specifically?**
> The Presidio PII anonymisation library requires Python >= 3.10 and < 3.14.
> Python 3.14 (released late 2024) is explicitly not yet supported.
> Install 3.13 even if a later version is already present — Windows supports multiple Python versions side by side.

---

## 1. Clone the Repository

```bash
git clone <repository-url>
cd JoannaLittleHelper
```

---

## 2. Install JavaScript Dependencies

```bash
npm install
```

---

## 3. Office Add-in Dev Certificates

JLH's dev server runs on HTTPS (required by Office Add-ins). Generate a trusted local certificate:

```bash
npx office-addin-dev-certs install
```

You will be prompted to trust the certificate — accept it. This is a one-time step.

---

## 4. Set Up Presidio (PII Anonymisation Service)

Presidio is a Python service that detects and removes personally identifiable information (PII) from document text before anything is sent to the AI. It runs locally — no data leaves your machine during anonymisation.

### 4.1 Install Python 3.13

Download the **Windows installer (64-bit)** for Python 3.13 from [python.org](https://www.python.org/downloads/release/python-3130/).

During installation:
- **Check** "Use admin privileges when installing py.exe"
- **Uncheck** "Add python.exe to PATH" (to avoid overriding any other Python version you have)

Verify the install — you should see 3.13 listed:

```
py -0
```

Expected output includes:
```
-V:3.13          Python 3.13 (64-bit)
```

### 4.2 Create the Virtual Environment

From the project root:

```bash
py -3.13 -m venv server\presidio-venv
```

### 4.3 Install Presidio Packages

```bash
server\presidio-venv\Scripts\pip install presidio-analyzer presidio-anonymizer
```

This installs Presidio and its dependencies (including spaCy). Allow 1–2 minutes.

### 4.4 Download the NLP Model

Presidio uses a large English language model (~400 MB) to detect names, organisations, and locations:

```bash
server\presidio-venv\Scripts\python -m spacy download en_core_web_lg
```

Allow 2–5 minutes depending on connection speed. This is a one-time download.

### 4.5 Verify the Installation

Run a quick smoke test:

```bash
server\presidio-venv\Scripts\python -c "from presidio_analyzer import AnalyzerEngine; from presidio_anonymizer import AnonymizerEngine; a = AnalyzerEngine(); an = AnonymizerEngine(); r = a.analyze('John Smith called from 07700 900123', language='en'); print(an.anonymize('John Smith called from 07700 900123', r).text)"
```

Expected output:
```
<PERSON> called from <PHONE_NUMBER>
```

---

## 5. Running JLH

JLH requires two processes running at the same time: the Presidio service and the Webpack dev server.

### Terminal 1 — Start the Presidio service

```bash
server\presidio-venv\Scripts\python server\presidioServer.py
```

Wait for:
```
[Presidio] Ready on http://localhost:3002
```

The first startup takes 5–10 seconds while the NLP model loads.

### Terminal 2 — Start the dev server

```bash
npm run dev-server
```

### Launch Word with the add-in

```bash
npm start
```

This opens Word with JLH loaded in the task pane.

---

## 6. Stopping

- Presidio service: `Ctrl+C` in Terminal 1
- Dev server: `Ctrl+C` in Terminal 2
- Word debugging: `npm stop`

---

## Known Issues

See [README.md](../README.md#known-technical-issues) for known platform issues and workarounds.
