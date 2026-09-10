import unittest

from nlp import WORDS, check, suggest


class WerketNlpTest(unittest.TestCase):
    def test_real_dictionary_loaded(self):
        self.assertGreater(len(WORDS), 10000)

    def test_prefix_hints_are_dictionary_words(self):
        dictionary = {item['w'] for item in WORDS}
        result = suggest('ሰላ')
        self.assertTrue(result['words'])
        self.assertTrue(set(result['words']).issubset(dictionary))

    def test_next_word_model_returns_words(self):
        self.assertTrue(suggest('ሰላም ')['next'])

    def test_unknown_word_has_ranked_corrections(self):
        result = check('ሰላም እንዳ')
        unknown = result[1]
        self.assertFalse(unknown['known'])
        self.assertEqual(unknown['suggestions'][0]['word'], 'እንደ')


if __name__ == '__main__':
    unittest.main()
