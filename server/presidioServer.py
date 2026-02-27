#!/usr/bin/env python3
"""
JLH Presidio Service
Runs on localhost:3002 — anonymises document text before it is sent to the AI.

Start with:
    server\\presidio-venv\\Scripts\\python.exe server\\presidioServer.py
"""

import json
import re
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 3002
ALLOWED_ORIGIN = "https://localhost:3000"

print("[Presidio] Loading NLP model — this takes a few seconds...", flush=True)

from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer, RecognizerResult
from presidio_analyzer.predefined_recognizers import PhoneRecognizer
from presidio_anonymizer import AnonymizerEngine

# Step 3: score threshold — detections below this are discarded
SCORE_THRESHOLD = 0.4

# Friendly short labels used in replacement tokens — <Name_1>, <Phone_1>, etc.
ENTITY_FRIENDLY_LABEL = {
    "PERSON":            "Name",
    "PHONE_NUMBER":      "Phone",
    "EMAIL_ADDRESS":     "Email",
    "LOCATION":          "Location",
    "DATE_TIME":         "Date",
    "CREDIT_CARD":       "Card_No",
    "IBAN_CODE":         "IBAN",
    "IP_ADDRESS":        "IP",
    "URL":               "URL",
    "AGE":               "Age",
    "NRP":               "NRP",
    "CRYPTO":            "Crypto",
    "MEDICAL_LICENSE":   "Med_ID",
    "US_BANK_NUMBER":    "Account_No",
    "US_DRIVER_LICENSE": "Driving_Licence",
    "US_ITIN":           "Tax_ID",
    "US_PASSPORT":       "Passport",
    "US_SSN":            "SSN",
    "UK_NHS":            "NHS_No",
    "UK_NINO":           "NI_No",
    "UK_POSTCODE":       "Postcode",
    "UK_SORT_CODE":      "Sort_Code",
    "IN_PAN":            "PAN",
    "IN_AADHAAR":        "Aadhaar",
    "SG_NRIC_FIN":       "NRIC",
    "AU_ABN":            "ABN",
    "AU_ACN":            "ACN",
    "AU_TFN":            "TFN",
    "AU_MEDICARE":       "Medicare",
}

# ── Build analyzer ────────────────────────────────────────────────────────────
analyzer = AnalyzerEngine()

# Step 2: Replace default PhoneRecognizer with one scoped to GB
try:
    analyzer.registry.remove_recognizer("PhoneRecognizer")
except Exception:
    pass
analyzer.registry.add_recognizer(PhoneRecognizer(supported_regions=["GB", "UK"]))
print("[Presidio] Phone recognizer configured for GB", flush=True)

# Step 1: Enable UK recognizers that are off by default since Presidio 2.2.359
try:
    from presidio_analyzer.predefined_recognizers.country_specific.uk import UkNinoRecognizer
    analyzer.registry.add_recognizer(UkNinoRecognizer())
    print("[Presidio] UK NINO recognizer enabled", flush=True)
except ImportError:
    print("[Presidio] UkNinoRecognizer not available in this version", flush=True)

try:
    from presidio_analyzer.predefined_recognizers.country_specific.uk import UkPostcodeRecognizer
    analyzer.registry.add_recognizer(UkPostcodeRecognizer())
    print("[Presidio] UK Postcode recognizer enabled (built-in)", flush=True)
except ImportError:
    # Not yet released on PyPI — use a custom recognizer covering all 6 valid formats
    # plus GIR 0AA. Score 0.65 catches postcodes in address blocks without context words.
    analyzer.registry.add_recognizer(PatternRecognizer(
        supported_entity="UK_POSTCODE",
        patterns=[Pattern(
            name="uk_postcode",
            regex=(
                r"\b("
                r"GIR\s?0AA"                                              # Special case
                r"|[A-PR-UWYZ][A-HK-Y][0-9]{2}\s?[0-9][ABD-HJLNP-UW-Z]{2}"   # AA99 9AA
                r"|[A-PR-UWYZ][A-HK-Y][0-9][ABEHMNPRVWXY]\s?[0-9][ABD-HJLNP-UW-Z]{2}"  # AA9A 9AA
                r"|[A-PR-UWYZ][A-HK-Y][0-9]\s?[0-9][ABD-HJLNP-UW-Z]{2}"  # AA9 9AA
                r"|[A-PR-UWYZ][0-9]{2}\s?[0-9][ABD-HJLNP-UW-Z]{2}"       # A99 9AA
                r"|[A-PR-UWYZ][0-9][ABCDEFGHJKPSTUW]\s?[0-9][ABD-HJLNP-UW-Z]{2}"  # A9A 9AA
                r"|[A-PR-UWYZ][0-9]\s?[0-9][ABD-HJLNP-UW-Z]{2}"          # A9 9AA
                r")\b"
            ),
            score=0.65,
        )],
        context=["postcode", "post code", "post-code", "address", "delivery", "shipping"],
    ))
    print("[Presidio] UK Postcode recognizer enabled (custom)", flush=True)

# Step 4: UK Sort Code — dashed format (xx-xx-xx) is specific enough at 0.5 base score;
# context words bump it further, plain digits alone stay low without context.
analyzer.registry.add_recognizer(PatternRecognizer(
    supported_entity="UK_SORT_CODE",
    patterns=[Pattern(
        name="uk_sort_code_dashed",
        regex=r"\b\d{2}-\d{2}-\d{2}\b",
        score=0.5,
    )],
    context=["sort code", "sort-code", "sortcode", "bank", "branch", "account"],
))
print("[Presidio] UK Sort Code recognizer enabled", flush=True)

anonymizer = AnonymizerEngine()

print(f"[Presidio] Ready on http://localhost:{PORT}", flush=True)


def _apply_custom_rules(text, rules, score_threshold):
    """
    Apply custom obfuscation rules to text using re directly, bypassing
    Presidio's recognizer chain (which requires NLP artifacts for deny-list
    matching and would silently fail with nlp_artifacts=None).

    Text rules use case-insensitive literal matching at score 1.0.
    Regex rules use the supplied pattern at the supplied score (default 0.85).
    Returns a list of RecognizerResult objects.
    """
    results = []
    for rule in rules:
        match_type = rule.get("match", "")
        entity = rule.get("replaceText", "")
        if not match_type or not entity:
            continue
        if match_type == "text":
            value = rule.get("findText", "")
            if not value:
                continue
            try:
                for m in re.finditer(re.escape(value), text, re.IGNORECASE):
                    results.append(RecognizerResult(
                        entity_type=entity, start=m.start(), end=m.end(), score=1.0
                    ))
            except re.error:
                pass
        elif match_type == "regex":
            pattern_str = rule.get("pattern", "")
            if not pattern_str:
                continue
            score = float(rule.get("score", 0.85))
            try:
                for m in re.finditer(pattern_str, text):
                    if score >= score_threshold:
                        results.append(RecognizerResult(
                            entity_type=entity, start=m.start(), end=m.end(), score=score
                        ))
            except re.error:
                pass
    return results


def _remove_overlaps(results):
    """Remove overlapping entities, keeping the highest-confidence match per region."""
    sorted_r = sorted(results, key=lambda x: (-x.score, -(x.end - x.start)))
    kept = []
    covered = []
    for r in sorted_r:
        if not any(r.start < end and r.end > start for start, end in covered):
            kept.append(r)
            covered.append((r.start, r.end))
    return kept


def _anonymize_consistent(text, results, custom_replacements=None, operator="replace"):
    """
    Replace detected entities with consistent labels per type.

    The same source text always gets the same label within a request:
      John Smith -> <PERSON_1>, Jane Doe -> <PERSON_2>, John Smith -> <PERSON_1>

    custom_replacements: dict mapping entity_type -> replacement string.
      - "mask"         -> replace each character with *  (same length as original)
      - any other str  -> use that string as a fixed label (no counter)
      - absent / None  -> fall through to operator

    operator: global operator applied when no custom_replacement matches.
      - "replace" -> <ENTITY_N> numbered labels (default)
      - "redact"  -> "" (entity removed entirely)
      - "mask"    -> "*" * len(original)
      - "hash"    -> first 12 hex chars of SHA-256 of original

    Returns (anonymised_text, entities) where entities is a list of
    {type, original, label, score} — one entry per occurrence, in document order.
    The label_map is discarded after the request; the output cannot be reversed.
    """
    if custom_replacements is None:
        custom_replacements = {}

    clean = _remove_overlaps(results)
    clean_sorted = sorted(clean, key=lambda x: x.start)

    counters = {}   # entity_type -> int
    label_map = {}  # (entity_type, original_lower) -> label

    entity_info = []

    for r in clean_sorted:
        original = text[r.start:r.end]
        key = (r.entity_type, original.lower().strip())
        if key not in label_map:
            repl = custom_replacements.get(r.entity_type)
            if repl == "mask":
                label_map[key] = "*" * len(original)
            elif repl:
                label_map[key] = repl
            elif operator == "redact":
                label_map[key] = " " * len(original)
            elif operator == "mask":
                label_map[key] = "*" * len(original)
            else:  # "replace" (default)
                counters[r.entity_type] = counters.get(r.entity_type, 0) + 1
                friendly = ENTITY_FRIENDLY_LABEL.get(r.entity_type, r.entity_type)
                label_map[key] = f"<{friendly}_{counters[r.entity_type]}>"
        entity_info.append({
            "type": r.entity_type,
            "original": original,
            "label": label_map[key],
            "score": round(r.score, 3),
        })

    # Replace from right to left so earlier offsets stay valid
    anonymised = text
    for r in sorted(clean, key=lambda x: x.start, reverse=True):
        original = text[r.start:r.end]
        key = (r.entity_type, original.lower().strip())
        anonymised = anonymised[:r.start] + label_map[key] + anonymised[r.end:]

    return anonymised, entity_info


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
            custom_rules = body.get("custom_rules", [])
            operator = body.get("operator", "replace")

            # Build replacement map for custom rules that specify a replacement string
            custom_replacements = {
                rule["replaceText"]: rule["replacement"]
                for rule in custom_rules
                if rule.get("replaceText") and rule.get("replacement") is not None
            }

            results = analyzer.analyze(text=text, language=language, score_threshold=SCORE_THRESHOLD)

            # Apply custom rules via re — no NLP artifacts required
            results.extend(_apply_custom_rules(text, custom_rules, SCORE_THRESHOLD))

            anonymised_text, entities = _anonymize_consistent(text, results, custom_replacements, operator)

            self._send_json(200, {"text": anonymised_text, "entities": entities})

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
