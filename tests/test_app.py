import json
import threading
import unittest
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer

import app


class WerketHttpTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), app.WerketHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = 'http://127.0.0.1:%d' % cls.server.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def get(self, path):
        with urllib.request.urlopen(self.base + path, timeout=10) as response:
            return response.status, response.read()

    def test_editor_assets_are_served(self):
        for path in ('/', '/manifest.json', '/sw.js', '/robots.txt', '/sitemap.xml', '/privacy',
                     '/static/werket.js', '/static/werket.css', '/static/icon-192.png',
                     '/static/icon-512.png', '/static/icon-maskable-512.png', '/static/apple-touch-icon.png'):
            status, body = self.get(path)
            self.assertEqual(status, 200, path)
            self.assertTrue(body, path)

    def test_editor_has_workspace_features(self):
        status, body = self.get('/')
        html = body.decode('utf-8')
        self.assertEqual(status, 200)
        for marker in ('fileTree', 'templateDialog', 'fontFamily', 'fontSize', 'keyboardPanel',
                       'homeScreen', 'newBtn', 'newMenu', 'installBanner', 'og:title',
                       'application/ld+json'):
            self.assertIn(marker, html)
        self.assertNotIn('id="lineNumbers"', html)

    def test_manifest_has_store_icons(self):
        status, body = self.get('/manifest.json')
        payload = json.loads(body)
        self.assertEqual(payload['name'], 'Werket — Amharic Editor')
        self.assertTrue(payload['icons'])
        self.assertTrue(payload['screenshots'])

    def test_suggestions_and_spell_api(self):
        encoded = urllib.parse.quote('ሰላም እንዳ')
        status, body = self.get('/api/check?text=' + encoded)
        self.assertEqual(status, 200)
        payload = json.loads(body)
        self.assertFalse(payload['words'][1]['known'])
        status, body = self.get('/api/suggest?text=' + urllib.parse.quote('ሰላ'))
        self.assertEqual(status, 200)
        self.assertIn('ሰላም', json.loads(body)['words'])


if __name__ == '__main__':
    unittest.main()
