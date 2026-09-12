"""Django tests for Werket."""
import json

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import Workspace


def _post(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type='application/json')


class AuthApiTest(TestCase):
    def test_register_login_logout(self):
        # Anonymous /api/me returns null.
        me = self.client.get(reverse('api_me'))
        self.assertEqual(me.status_code, 200)
        self.assertIsNone(me.json()['user'])

        # Register over JSON signs the user in.
        register = _post(self.client, reverse('api_register'), {
            'name': 'Writer', 'email': 'writer@example.com', 'password': 'WerketPass123',
        })
        self.assertEqual(register.status_code, 201)
        user = register.json()['user']
        self.assertEqual(user['email'], 'writer@example.com')
        self.assertEqual(user['name'], 'Writer')

        me = self.client.get(reverse('api_me'))
        self.assertEqual(me.json()['user']['email'], 'writer@example.com')

        # Duplicate email is rejected.
        duplicate = _post(self.client, reverse('api_register'), {
            'name': 'Other', 'email': 'writer@example.com', 'password': 'WerketPass123',
        })
        self.assertEqual(duplicate.status_code, 409)

        # Logout clears the session.
        logout = _post(self.client, reverse('api_logout'), {})
        self.assertEqual(logout.json()['ok'], True)
        me = self.client.get(reverse('api_me'))
        self.assertIsNone(me.json()['user'])

    def test_login_with_credentials(self):
        User.objects.create_user('writer@example.com', 'writer@example.com', 'WerketPass123')
        bad = _post(self.client, reverse('api_login'), {
            'email': 'writer@example.com', 'password': 'wrong',
        })
        self.assertEqual(bad.status_code, 401)

        good = _post(self.client, reverse('api_login'), {
            'email': 'writer@example.com', 'password': 'WerketPass123',
        })
        self.assertEqual(good.status_code, 200)
        self.assertEqual(good.json()['user']['email'], 'writer@example.com')
        me = self.client.get(reverse('api_me'))
        self.assertEqual(me.json()['user']['email'], 'writer@example.com')


class FilesApiTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('writer', 'writer@example.com', 'WerketPass123')
        self.client.force_login(self.user)

    def test_save_and_load_roundtrip(self):
        payload = {
            'files': [{'id': 'f-1', 'name': 'One.md', 'text': '<p>ሰላም</p>', 'lang': 'am'}],
            'openIds': ['f-1'], 'activeId': 'f-1',
            'projectName': 'My documents', 'font': 'Noto Sans Ethiopic', 'size': 18,
            'align': 'left', 'lang': 'am',
        }
        save = _post(self.client, reverse('api_files_save'), payload)
        self.assertEqual(save.json()['ok'], True)

        loaded = self.client.get(reverse('api_files')).json()
        self.assertEqual(loaded['files'], payload['files'])
        self.assertEqual(loaded['activeId'], 'f-1')
        self.assertEqual(loaded['lang'], 'am')

        # Saved in the Workspace rows.
        workspace = Workspace.objects.get(user=self.user)
        self.assertEqual(workspace.data['files'][0]['name'], 'One.md')

    def test_users_are_isolated(self):
        _post(self.client, reverse('api_files_save'), {'files': [{'id': 'a'}], 'activeId': 'a'})
        other = User.objects.create_user('other', 'other@example.com', 'WerketPass123')
        self.client.force_login(other)
        loaded = self.client.get(reverse('api_files')).json()
        self.assertEqual(loaded.get('files'), None)

    def test_anonymous_is_rejected(self):
        self.client.logout()
        save = _post(self.client, reverse('api_files_save'), {'files': []})
        self.assertEqual(save.status_code, 401)
        load = self.client.get(reverse('api_files'))
        self.assertEqual(load.status_code, 401)


class SpellApiTest(TestCase):
    def test_check(self):
        response = self.client.get(reverse('api_check'), {'text': 'ሰላም እንዳ'})
        self.assertEqual(response.status_code, 200)
        words = response.json()['words']
        self.assertTrue(words[0]['known'])
        self.assertFalse(words[1]['known'])
        self.assertIn('word', words[0])
        self.assertIn('start', words[0])
        self.assertIn('suggestions', words[0])

    def test_suggest(self):
        response = self.client.get(reverse('api_suggest'), {'text': 'ሰላ'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('words', data)
        self.assertIn('next', data)
        self.assertTrue(any(w.startswith('ሰላ') for w in data['words']))

    def test_english_words_are_not_flagged(self):
        response = self.client.get(reverse('api_check'), {'text': 'hello world today'})
        words = response.json()['words']
        self.assertEqual(words, [])


class PagesAndPwaTest(TestCase):
    def test_index_is_public(self):
        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Werket')

    def test_pwa_assets_are_public(self):
        for name in ('manifest', 'sw', 'robots', 'sitemap', 'privacy'):
            response = self.client.get(reverse(name))
            self.assertEqual(response.status_code, 200)

    def test_auth_pages(self):
        self.assertEqual(self.client.get(reverse('login')).status_code, 200)
        self.assertEqual(self.client.get(reverse('register')).status_code, 200)