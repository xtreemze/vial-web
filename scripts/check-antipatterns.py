#!/usr/bin/env python3
"""Fail on project anti-patterns that generic linters cannot express reliably."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCAN_ROOTS = (ROOT / "src", ROOT / "next" / "src")
SUFFIXES = {".css", ".html", ".js", ".jsx", ".ts", ".tsx"}
EXCLUDED = {ROOT / "src" / "simpleeval.py"}

RULES = (
    (
        "unsafe-html-sink",
        re.compile(r"\b(?:innerHTML|outerHTML)\s*=|\binsertAdjacentHTML\s*\(|\bdocument\.write\s*\("),
        "Build DOM with typed nodes/textContent; string-to-DOM sinks are forbidden.",
    ),
    (
        "dynamic-code",
        re.compile(r"\beval\s*\(|\bnew\s+Function\s*\("),
        "Dynamic code execution is forbidden.",
    ),
    (
        "inline-event-handler",
        re.compile(r"\son[a-z]+\s*=", re.IGNORECASE),
        "Inline DOM event attributes are forbidden; use addEventListener and explicit teardown.",
    ),
    (
        "device-sniffing",
        re.compile(r"\bnavigator\.(?:userAgent|platform)\b"),
        "UA/platform sniffing is forbidden; use capability and input-feature detection.",
    ),
    (
        "js-layout-breakpoint",
        re.compile(r"\b(?:window\.)?(?:innerWidth|innerHeight)\b|\bscreen\.(?:width|height)\b"),
        "JavaScript layout breakpoints are forbidden; use CSS/container queries.",
    ),
    (
        "mouse-touch-specific-handler",
        re.compile(r"addEventListener\(\s*['\"](?:mouse(?:down|up|move|enter|leave)|touch(?:start|move|end|cancel))['\"]"),
        "Mouse/touch-specific interaction is forbidden; use pointer events plus keyboard semantics.",
    ),
    (
        "desktop-first-query",
        re.compile(r"@(?:media|container)[^{\n]*\bmax-width\s*:", re.IGNORECASE),
        "Descending max-width queries are forbidden; base styles must be mobile-first with ascending min-width/container queries.",
    ),
    (
        "viewport-unit-trap",
        re.compile(r"\b100v[wh]\b", re.IGNORECASE),
        "100vh/100vw are forbidden because they create mobile viewport/scrollbar traps; prefer dynamic/small viewport units or container sizing.",
    ),
    (
        "overflow-masking",
        re.compile(r"\boverflow(?:-[xy])?\s*:\s*(?:hidden|clip)\b", re.IGNORECASE),
        "Overflow masking is forbidden as a layout repair; resolve the underlying sizing/containment problem.",
    ),
    (
        "transition-all",
        re.compile(r"\btransition\s*:\s*all\b", re.IGNORECASE),
        "transition: all is forbidden; enumerate compositor-safe properties.",
    ),
    (
        "important",
        re.compile(r"!important\b", re.IGNORECASE),
        "!important is forbidden; fix cascade ownership/specificity instead.",
    ),
    (
        "physical-horizontal-css",
        re.compile(
            r"\b(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:",
            re.IGNORECASE,
        ),
        "Physical left/right CSS is forbidden; use logical properties.",
    ),
    (
        "typescript-escape-hatch",
        re.compile(r"\b(?:as\s+any|:\s*any\b|as\s+unknown\s+as\b)|@ts-(?:ignore|expect-error|nocheck)\b"),
        "Type escapes/suppressions are forbidden in the native TypeScript path.",
    ),
    (
        "ambient-nondeterminism",
        re.compile(r"\bMath\.random\s*\(|\bDate\.now\s*\(|\bnew\s+Date\s*\("),
        "Ambient time/randomness is forbidden in domain code; inject clocks/entropy explicitly.",
    ),
    (
        "broad-lint-suppression",
        re.compile(r"(?:eslint|biome|stylelint)-disable\b|\bNOLINT(?:NEXTLINE|BEGIN|END)?\b"),
        "Broad inline lint suppression is forbidden; fix the cause or encode a narrow repository-level exception.",
    ),
)

def iter_files() -> list[Path]:
    files: list[Path] = []
    for root in SCAN_ROOTS:
        if not root.exists():
            continue
        files.extend(
            path
            for path in root.rglob("*")
            if path.is_file() and path.suffix in SUFFIXES and path not in EXCLUDED
        )
    return sorted(files)


def main() -> int:
    violations: list[str] = []
    for path in iter_files():
        text = path.read_text(encoding="utf-8")
        relative = path.relative_to(ROOT)
        for line_number, line in enumerate(text.splitlines(), start=1):
            for rule, pattern, message in RULES:
                # React JSX event props are typed component/event bindings, not
                # string-valued HTML inline event attributes. Keep the rule
                # strict for HTML and script-generated markup without forcing
                # React code away from its declarative event model.
                if rule == "inline-event-handler" and path.suffix in {".jsx", ".tsx"}:
                    continue
                if pattern.search(line):
                    violations.append(f"{relative}:{line_number}: {rule}: {message}")

    if violations:
        print("Web anti-pattern policy violations:", file=sys.stderr)
        for violation in violations:
            print(f"  {violation}", file=sys.stderr)
        return 1

    print("Web anti-pattern policy: clean")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
