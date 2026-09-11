#!/usr/bin/env python3
"""Werket: standalone Amharic writing workspace server with user accounts."""
import hashlib
import json
import os
import secrets
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from nlp import check, suggest

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get('PORT', '8765'))
DATA_DIR = os.path.join(ROOT, 'data')
USERS_DIR = os.path.join(DATA_DIR, 'users')
os.makedirs(USERS_DIR, exist_ok=True)

def _hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{h}"

def _verify_password(stored, password):
    salt, h = stored.split(':')
    return hashlib.sha256((salt + password).encode()).hexdigest() == h

def _load_users():
    path = os.path.join(USERS_DIR, '_index.json')
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}

def _save_users(users):
    path = os.path.join(USERS_DIR, '_index.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False)

def _get_session(handler):
    cookie = handler.headers.get('Cookie', '')
    for part in cookie.split(';'):
        kv = part.strip().split('=', 1)
        if len(kv) == 2 and kv[0] == 'wk_session':
            return kv[1]
    return None

def _set_session(handler, token):
    handler.send_header('Set-Cookie', f'wk_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800')

def _user_dir(user_id):
    d = os.path.join(USERS_DIR, user_id)
    os.makedirs(d, exist_ok=True)
    return d

def _get_user(handler):
    token = _get_session(handler)
    if not token:
        return None
    users = _load_users()
    for uid, data in users.items():
        if data.get('session') == token:
            return {'id': uid, 'name': data.get('name', ''), 'email': data.get('email', '')}
    return None

class WerketHandler(BaseHTTPRequestHandler):
    MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
            '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml; charset=utf-8',
            '.txt': 'text/plain; charset=utf-8'}

    def _send(self, body, content_type='text/plain; charset=utf-8', code=200, extra_headers=None):
        if isinstance(body, str): body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode('utf-8'))

    def do_GET(self):
        parsed = urlparse(self.path); path = parsed.path.rstrip('/') or '/'
        if path == '/api/suggest':
            self._send(json.dumps(suggest(parse_qs(parsed.query).get('text', [''])[0]), ensure_ascii=False), 'application/json; charset=utf-8'); return
        if path == '/api/check':
            text = parse_qs(parsed.query).get('text', [''])[0]
            self._send(json.dumps({'text': text, 'words': check(text)}, ensure_ascii=False), 'application/json; charset=utf-8'); return
        if path == '/api/me':
            user = _get_user(self)
            self._send(json.dumps({'user': user}, ensure_ascii=False), 'application/json; charset=utf-8'); return
        if path == '/api/files':
            user = _get_user(self)
            if not user:
                self._send(json.dumps({'error': 'Not logged in'}), 'application/json; charset=utf-8', 401); return
            files_path = os.path.join(_user_dir(user['id']), 'workspace.json')
            try:
                with open(files_path, encoding='utf-8') as f:
                    data = f.read()
                self._send(data, 'application/json; charset=utf-8')
            except OSError:
                self._send(json.dumps({'files': [], 'projectName': 'My documents'}), 'application/json; charset=utf-8')
            return
        if path == '/manifest.json': path = '/static/manifest.json'
        if path == '/sw.js': path = '/static/sw.js'
        if path == '/robots.txt': path = '/static/robots.txt'
        if path == '/sitemap.xml': path = '/static/sitemap.xml'
        if path == '/privacy': path = '/static/privacy.html'
        rel = 'templates/index.html' if path == '/' else path.lstrip('/')
        if rel.startswith('../') or os.path.isabs(rel): self._send('forbidden', code=403); return
        full = os.path.join(ROOT, rel)
        try:
            with open(full, 'rb') as f: body = f.read()
        except OSError: self._send('not found', code=404); return
        ext = os.path.splitext(full)[1]
        ctype = self.MIME.get(ext, 'application/octet-stream')
        if ext == '.html':
            ctype = 'text/html; charset=utf-8'
        self._send(body, ctype)

    def do_POST(self):
        parsed = urlparse(self.path); path = parsed.path.rstrip('/')
        if path == '/api/register':
            body = self._json_body()
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''
            name = (body.get('name') or '').strip()
            if not email or not password or len(password) < 4:
                self._send(json.dumps({'error': 'Email and password (4+ chars) required'}), 'application/json; charset=utf-8', 400); return
            users = _load_users()
            for u in users.values():
                if u.get('email') == email:
                    self._send(json.dumps({'error': 'Email already registered'}), 'application/json; charset=utf-8', 409); return
            uid = secrets.token_hex(8)
            token = secrets.token_hex(16)
            users[uid] = {
                'email': email,
                'name': name or email.split('@')[0],
                'password': _hash_password(password),
                'session': token,
                'created': int(time.time())
            }
            _save_users(users)
            _user_dir(uid)
            resp = json.dumps({'user': {'id': uid, 'name': users[uid]['name'], 'email': email}})
            self._send(resp, 'application/json; charset=utf-8', 201, {'Set-Cookie': f'wk_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800'})
            return
        if path == '/api/login':
            body = self._json_body()
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''
            users = _load_users()
            for uid, data in users.items():
                if data.get('email') == email and _verify_password(data.get('password', ''), password):
                    token = secrets.token_hex(16)
                    data['session'] = token
                    _save_users(users)
                    resp = json.dumps({'user': {'id': uid, 'name': data.get('name', ''), 'email': email}})
                    self._send(resp, 'application/json; charset=utf-8', extra_headers={'Set-Cookie': f'wk_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800'})
                    return
            self._send(json.dumps({'error': 'Invalid email or password'}), 'application/json; charset=utf-8', 401); return
        if path == '/api/logout':
            token = _get_session(self)
            if token:
                users = _load_users()
                for uid, data in users.items():
                    if data.get('session') == token:
                        data['session'] = ''
                        _save_users(users)
                        break
            self._send(json.dumps({'ok': True}), 'application/json; charset=utf-8', extra_headers={'Set-Cookie': 'wk_session=; Path=/; Max-Age=0'})
            return
        if path == '/api/files/save':
            user = _get_user(self)
            if not user:
                self._send(json.dumps({'error': 'Not logged in'}), 'application/json; charset=utf-8', 401); return
            body = self._json_body()
            files_path = os.path.join(_user_dir(user['id']), 'workspace.json')
            with open(files_path, 'w', encoding='utf-8') as f:
                json.dump(body, f, ensure_ascii=False)
            self._send(json.dumps({'ok': True, 'saved': int(time.time())}), 'application/json; charset=utf-8'); return
        self._send(json.dumps({'error': 'Not found'}), 'application/json; charset=utf-8', 404)

    def log_message(self, fmt, *args): pass

def main():
    server = ThreadingHTTPServer(('0.0.0.0', PORT), WerketHandler)
    print('Werket running at http://localhost:%d' % server.server_address[1])
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__ == '__main__': main()
