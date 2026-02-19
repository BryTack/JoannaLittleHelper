#!/usr/bin/env python3
"""
JLH Presidio Service
Runs on localhost:3002 — anonymises document text before it is sent to the AI.

Start with:
    server\\presidio-venv\\Scripts\\python.exe server\\presidioServer.py
"""

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 3002
ALLOWED_ORIGIN = "https://localhost:3000"

print("[Presidio] Loading NLP model — this takes a few seconds...", flush=True)

from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

print(f"[Presidio] Ready on http://localhost:{PORT}", flush=True)


class Handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_POST(self):
        if self.path != "/anonymize":
            self.send_response(404)
            self.end_headers()
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            text = body.get("text", "")
            language = body.get("language", "en")

            results = analyzer.analyze(text=text, language=language)
            anonymized = anonymizer.anonymize(text=text, analyzer_results=results)

            response = {
                "text": anonymized.text,
                "entities": [
                    {
                        "type": r.entity_type,
                        "start": r.start,
                        "end": r.end,
                        "score": round(r.score, 3),
                    }
                    for r in sorted(results, key=lambda x: x.start)
                ],
            }
            self._send_json(200, response)

        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _send_json(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, format, *args):
        print(f"[Presidio] {self.address_string()} - {format % args}", flush=True)


if __name__ == "__main__":
    try:
        server = HTTPServer(("localhost", PORT), Handler)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Presidio] Stopped.", flush=True)
        sys.exit(0)
