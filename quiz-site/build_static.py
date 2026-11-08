#!/usr/bin/env python3
"""Build a static copy of the practice exam site (for GitHub Pages).

Writes index.html, app.js, parser.js, style.css and sets.json (every markdown
source from quiz.config.json, pre-collected) into the output folder. The app
loads sets.json whenever the /api/sets endpoint of server.py isn't available.

Usage:  python3 build_static.py [--out ../_site]
"""
import argparse
import json
import os
import shutil

from server import ROOT, build_payload

STATIC_FILES = ["index.html", "app.js", "parser.js", "style.css"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "..", "_site"))
    args = ap.parse_args()
    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)
    for name in STATIC_FILES:
        shutil.copy2(os.path.join(ROOT, name), os.path.join(out, name))
    payload = build_payload()
    if payload["errors"]:
        raise SystemExit("Build failed:\n" + "\n".join(payload["errors"]))
    with open(os.path.join(out, "sets.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    open(os.path.join(out, ".nojekyll"), "w").close()
    print(f"Built {len(payload['files'])} source files into {out}")


if __name__ == "__main__":
    main()
