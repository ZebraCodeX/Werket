#!/usr/bin/env python3
"""Werket: standalone Amharic writing workspace server."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from nlp import check, suggest

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get('PORT', '8765'))

class WerketHandler(BaseHTTPRequestHandler):
    MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
            '.svg': 'image/svg+xml'}

    def _send(self, body, content_type='text/plain; charset=utf-8', code=200):
        if isinstance(body, str): body = body.encode('utf-8')
        self.send_response(code); self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path); path = parsed.path.rstrip('/') or '/'
        if path == '/api/suggest':
            self._send(json.dumps(suggest(parse_qs(parsed.query).get('text', [''])[0]), ensure_ascii=False), 'application/json; charset=utf-8'); return
        if path == '/api/check':
            text = parse_qs(parsed.query).get('text', [''])[0]
            self._send(json.dumps({'text': text, 'words': check(text)}, ensure_ascii=False), 'application/json; charset=utf-8'); return
        if path == '/manifest.json': path = '/static/manifest.json'
        if path == '/sw.js': path = '/static/sw.js'
        rel = 'templates/index.html' if path == '/' else path.lstrip('/')
        if rel.startswith('../') or os.path.isabs(rel): self._send('forbidden', code=403); return
        full = os.path.join(ROOT, rel)
        try:
            with open(full, 'rb') as f: body = f.read()
        except OSError: self._send('not found', code=404); return
        ext = os.path.splitext(full)[1]
        self._send(body, self.MIME.get(ext, 'application/octet-stream'))

    def log_message(self, fmt, *args): pass

def main():
    server = ThreadingHTTPServer(('0.0.0.0', PORT), WerketHandler)
    print('Werket running at http://localhost:%d' % server.server_address[1])
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__ == '__main__': main()
