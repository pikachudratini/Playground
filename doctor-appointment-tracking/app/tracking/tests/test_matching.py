from django.test import SimpleTestCase

from tracking.matching import find_number_match, numbers_are_close


class NumbersAreCloseTests(SimpleTestCase):
    def test_exact(self):
        self.assertTrue(numbers_are_close("100248", "100248"))

    def test_adjacent_transposition(self):
        self.assertTrue(numbers_are_close("100248", "100284"))

    def test_single_substitution(self):
        self.assertTrue(numbers_are_close("100248", "100249"))

    def test_single_deletion(self):
        self.assertTrue(numbers_are_close("100248", "10048"))

    def test_far_apart_not_close(self):
        self.assertFalse(numbers_are_close("100248", "999999"))

    def test_two_edits_not_close(self):
        self.assertFalse(numbers_are_close("100248", "100299"))

    def test_non_adjacent_difference_not_transposition(self):
        self.assertFalse(numbers_are_close("100248", "800240"))


class FindNumberMatchTests(SimpleTestCase):
    def test_unique_match_returned(self):
        self.assertEqual(
            find_number_match("100284", {"100248": "A", "999999": "B"}), "A"
        )

    def test_ambiguous_match_returns_none(self):
        self.assertIsNone(
            find_number_match("100248", {"100247": "A", "100249": "B"})
        )

    def test_no_match_returns_none(self):
        self.assertIsNone(find_number_match("100284", {"999999": "B"}))
