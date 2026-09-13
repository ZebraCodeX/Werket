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
        # Anonymous /api/auth/me/ returns null.
        me = self.client.get(reverse('auth-me'))
        self.assertEqual(me.status_code, 200)
        self.assertIsNone(me.json()['user'])

        # Register over JSON signs the user in.
        register = _post(self.client, reverse('auth-register'), {
            'name': 'Writer', 'email': 'writer@example.com', 'password': 'WerketPass123',
        })
        self.assertEqual(register.status_code, 201)
        user = register.json()['user']
        self.assertEqual(user['email'], 'writer@example.com')
        self.assertEqual(user['name'], 'Writer')

        me = self.client.get(reverse('auth-me'))
        self.assertEqual(me.json()['user']['email'], 'writer@example.com')

        # Duplicate email is rejected.
        duplicate = _post(self.client, reverse('auth-register'), {
            'name': 'Other', 'email': 'writer@example.com', 'password': 'WerketPass123',
        })
        self.assertEqual(duplicate.status_code, 409)

        # Logout clears the session.
        logout = _post(self.client, reverse('auth-logout'), {})
        self.assertEqual(logout.json()['ok'], True)
        me = self.client.get(reverse('auth-me'))
        self.assertIsNone(me.json()['user'])

    def test_login_with_credentials(self):
        User.objects.create_user('writer@example.com', 'writer@example.com', 'WerketPass123')
        bad = _post(self.client, reverse('auth-login'), {
            'email': 'writer@example.com', 'password': 'wrong',
        })
        self.assertEqual(bad.status_code, 401)

        good = _post(self.client, reverse('auth-login'), {
            'email': 'writer@example.com', 'password': 'WerketPass123',
        })
        self.assertEqual(good.status_code, 200)
        self.assertEqual(good.json()['user']['email'], 'writer@example.com')
        me = self.client.get(reverse('auth-me'))
        self.assertEqual(me.json()['user']['email'], 'writer@example.com')


class WorkspaceApiTest(TestCase):
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
        save = self.client.post(reverse('workspace-list'), data=json.dumps(payload), content_type='application/json')
        self.assertEqual(save.status_code, 200)

        loaded = self.client.get(reverse('workspace-list')).json()
        self.assertEqual(loaded['files'], payload['files'])
        self.assertEqual(loaded['activeId'], 'f-1')
        self.assertEqual(loaded['lang'], 'am')

        # Saved in the Workspace rows.
        workspace = Workspace.objects.get(user=self.user)
        self.assertEqual(workspace.data['files'][0]['name'], 'One.md')

    def test_users_are_isolated(self):
        self.client.post(reverse('workspace-list'), data=json.dumps({'files': [{'id': 'a'}], 'activeId': 'a'}), content_type='application/json')
        other = User.objects.create_user('other', 'other@example.com', 'WerketPass123')
        self.client.force_login(other)
        loaded = self.client.get(reverse('workspace-list')).json()
        self.assertNotEqual(loaded.get('files'), [{'id': 'a'}])
        self.assertEqual(loaded.get('files'), None)
        self.assertEqual(loaded.get('activeId'), None)

    def test_anonymous_is_rejected(self):
        self.client.logout()
        # DRF SessionAuthentication returns 403 for anonymous (not 401).
        save = self.client.post(reverse('workspace-list'), data=json.dumps({'files': []}), content_type='application/json')
        self.assertIn(save.status_code, (401, 403))
        load = self.client.get(reverse('workspace-list'))
        self.assertIn(load.status_code, (401, 403))


class SpellApiTest(TestCase):
    def test_check(self):
        response = self.client.get(reverse('dictionary-check'), {'text': 'ሰላም ጅብጅብል'})
        self.assertEqual(response.status_code, 200)
        words = response.json()['words']
        self.assertTrue(words[0]['known'])
        self.assertFalse(words[1]['known'])
        self.assertIn('word', words[0])
        self.assertIn('start', words[0])
        self.assertIn('suggestions', words[0])

    def test_suggest(self):
        response = self.client.get(reverse('dictionary-suggest'), {'text': 'ሰላ'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('words', data)
        self.assertIn('next', data)
        self.assertTrue(any(w.startswith('ሰላ') for w in data['words']))

    def test_english_words_are_not_flagged(self):
        response = self.client.get(reverse('dictionary-check'), {'text': 'hello world today'})
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
        self.assertEqual(self.client.get(reverse('signup')).status_code, 200)

    def test_login_flow(self):
        User.objects.create_user('writer@example.com', 'writer@example.com', 'WerketPass123')
        response = self.client.post(reverse('login'), {
            'email': 'writer@example.com', 'password': 'WerketPass123',
        }, follow=True)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context['user'].is_authenticated)

    def test_signup_flow(self):
        response = self.client.post(reverse('signup'), {
            'name': 'New Writer',
            'email': 'new@example.com',
            'password': 'secret123',
        }, follow=True)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(User.objects.filter(email='new@example.com').exists())
        self.assertTrue(response.context['user'].is_authenticated)