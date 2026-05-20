"""Deterministic fuzzy matching for patient numbers — no AI.

Catches the common keying anomalies: adjacent-digit transposition and a
single-character edit (insert / delete / substitute).
"""


def _levenshtein(a, b):
    """Edit distance between two strings."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i]
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            current.append(
                min(
                    previous[j] + 1,        # deletion
                    current[j - 1] + 1,     # insertion
                    previous[j - 1] + cost,  # substitution
                )
            )
        previous = current
    return previous[-1]


def numbers_are_close(a, b):
    """True if a and b differ only by a likely keying error."""
    a, b = str(a).strip(), str(b).strip()
    if not a or not b:
        return False
    if a == b:
        return True
    # Adjacent-digit transposition (e.g. 48217 vs 42817).
    if len(a) == len(b):
        diffs = [i for i in range(len(a)) if a[i] != b[i]]
        if (
            len(diffs) == 2
            and diffs[1] == diffs[0] + 1
            and a[diffs[0]] == b[diffs[1]]
            and a[diffs[1]] == b[diffs[0]]
        ):
            return True
    # A single insert / delete / substitution.
    return _levenshtein(a, b) == 1


def find_number_match(target, candidates):
    """Return the single close candidate, or None.

    ``candidates`` is a dict mapping a number string to any object. A result
    is returned only when exactly one candidate is close — an ambiguous match
    (zero or several) always returns None so a human decides.
    """
    matches = [obj for number, obj in candidates.items() if numbers_are_close(target, number)]
    return matches[0] if len(matches) == 1 else None
