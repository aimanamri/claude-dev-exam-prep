#!/usr/bin/env python3
"""Local server for the CCDV-F practice exam site.

Serves the static site in this folder and exposes /api/sets, which returns
every markdown source listed in quiz.config.json (files, or folders whose
*.md files are all included). Drop a new set into ./sets/ and reload the page.

Usage:  python3 server.py [--port 8765] [--open]
"""
import argparse
import json
import os
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(ROOT, "quiz.config.json")


def load_config():
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def collect_files(config):
    files, errors = [], []
    for source in config.get("sources", []):
        rel = source["path"]
        path = os.path.normpath(os.path.join(ROOT, rel))
        if os.path.isdir(path):
            names = sorted(
                n for n in os.listdir(path)
                if n.lower().endswith(".md") and not n.startswith(("_", "."))
            )
            paths = [os.path.join(path, n) for n in names]
        elif os.path.isfile(path):
            paths = [path]
        else:
            errors.append(f"Source not found: {rel}")
            continue
        for p in paths:
            try:
                with open(p, encoding="utf-8") as f:
                    content = f.read()
            except OSError as e:
                errors.append(f"Could not read {p}: {e}")
                continue
            files.append({
                "file": os.path.relpath(p, ROOT),
                "name": os.path.basename(p),
                "mtime": os.path.getmtime(p),
                "content": content,
                "sets": source.get("sets", {}),
            })
    return files, errors


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the terminal quiet
        pass

    def do_GET(self):
        if self.path.split("?")[0] == "/api/sets":
            try:
                config = load_config()
                files, errors = collect_files(config)
                body = {"config": {k: v for k, v in config.items() if k != "sources"},
                        "files": files, "errors": errors}
                status = 200
            except Exception as e:  # surface config mistakes in the UI
                body, status = {"files": [], "errors": [f"Config error: {e}"]}, 500
            data = json.dumps(body).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8765)))
    ap.add_argument("--open", action="store_true", help="open the browser")
    args = ap.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://localhost:{args.port}/"
    print(f"CCDV-F practice exams running at {url}  (Ctrl+C to stop)")
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
