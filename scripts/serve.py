"""Local preview server. Sends no-store so a browser never shows a stale copy after an edit.

    python3 scripts/serve.py [port]
"""
import functools, http.server, os, sys

class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
print(f'FigureSense at http://localhost:{port}/')
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(NoStore, directory=root)).serve_forever()
