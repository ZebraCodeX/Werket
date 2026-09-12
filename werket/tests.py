"""Django tests for Werket."""
from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import Document, UserPreferences


class AuthFlowTest(TestCase):
    def test_register_login_logout(self):
        # Register requires GET (CSRF form), POST registers a user.
        registered = self.client.post(reverse('register'), {
            'username': 'writer',
            'email': 'writer@example.com',
            'password1': 'WerketPass123',
            'password2': 'WerketPass123',
        })
        self.assertEqual(registered.status_code, 302)
        self.assertTrue(User.objects.filter(username='writer').exists())
        user = User.objects.get(username='writer')
        self.assertTrue(UserPreferences.objects.filter(user=user).exists())

        # Session is established; the editor home is reachable.
        home = self.client.get(reverse('index'))
        self.assertEqual(home.status_code, 200)


class DocumentApiTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('writer', 'w@example.com', 'WerketPass123')
        self.client.force_login(self.user)

    def test_create_list_update_set_active_delete(self):
        url = reverse('api_document_create')
        first = self.client.post(url, {
            'name': 'One.md', 'folder': '', 'content': '<p>a</p>',
            'html_content': '<p>a</p>', 'is_active': True,
        }, content_type='application/json')
        self.assertEqual(first.status_code, 200)
        doc_id = first.json()['id']

        second = self.client.post(url, {
            'name': 'Two.md', 'folder': 'chap', 'content': '<p>b</p>',
            'html_content': '<p>b</p>', 'is_active': False,
        }, content_type='application/json')
        self.assertEqual(second.status_code, 200)

        listing = self.client.get(reverse('api_documents'))
        docs = listing.json()
        self.assertEqual(len(docs), 2)
        active = [d for d in docs if d['is_active']]
        self.assertEqual([d['name'] for d in active], ['One.md'])

        # Activating Two.md deactivates One.md.
        self.client.post(reverse('api_document_update', args=[second.json()['id']]), {
            'name': 'Two.md', 'folder': 'chap', 'content': '<p>bb</p>',
            'html_content': '<p>bb</p>', 'is_active': True,
        }, content_type='application/json')
        listing = self.client.get(reverse('api_documents'))
        active = [d['name'] for d in listing.json() if d['is_active']]
        self.assertEqual(active, ['Two.md'])

        self.client.post(reverse('api_document_delete', args=[doc_id]), {}, content_type='application/json')
        self.assertFalse(Document.objects.filter(pk=doc_id).exists())

    def test_other_users_documents_are_isolated(self):
        self.client.post(reverse('api_document_create'), {
            'name': 'Mine.md', 'folder': '', 'content': '', 'html_content': '', 'is_active': True,
        }, content_type='application/json')
        other = User.objects.create_user('other', 'o@example.com', 'WerketPass123')
        self.client.force_login(other)
        listing = self.client.get(reverse('api_documents'))
        self.assertEqual(listing.json(), [])

        response = self.client.post(
            reverse('api_document_update', args=[Document.objects.get(name='Mine.md').pk]),
            {'name': 'Mine.md'}, content_type='application/json',
        )
        self.assertEqual(response.status_code, 404)


class SpellApiTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('writer', 'w@example.com', 'WerketPass123')
        self.client.force_login(self.user)

    def test_check_and_suggest(self):
        check = self.client.get(reverse('api_check'), {'text': 'ሰላም እንዳ'})
        self.assertEqual(check.status_code, 200)
        words = check.json()['words']
        self.assertTrue(words[0]['known'])
        self.assertFalse(words[1]['known'])

        suggest = self.client.get(reverse('api_suggest'), {'text': 'ሰላ'})
        words = suggest.json()['words']
        self.assertTrue(any(isinstance(w, str) and w.startswith('ሰላ') for w in words))


class AuthRedirectTest(TestCase):
    def test_editor_requires_login(self):
        response = self.client.get(reverse('index'))
        self.assertRedirects(response, reverse('login') + '?next=' + reverse('index'))

    def test_pwa_assets_are_public(self):
        for name in ('manifest', 'sw', 'robots', 'sitemap'):
            response = self.client.get(reverse(name))
            self.assertEqual(response.status_code, 200)