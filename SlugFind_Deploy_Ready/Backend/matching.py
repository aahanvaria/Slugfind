"""Heuristic matching for SlugFind lost/found reports.

Scores indicate shared evidence, NOT the probability that two reports refer
 to the same physical object. Public attributes can be incomplete or mistaken.
"""

from datetime import datetime
from difflib import SequenceMatcher
import re

# Only filter common words when comparing distinct identifying details.
STOP_WORDS = {
    "a", "an", "the", "and", "or", "with", "without", "on", "in", "at",
    "near", "from", "of", "to", "for", "is", "was", "it", "i", "my",
    "found", "lost", "item", "some", "has", "have", "had", "there",
    "black", "white", "blue", "red", "green", "yellow", "gray", "grey",
    "backpack", "bag", "bottle", "water", "flask", "case", "key", "keys",
}

CATEGORY_ALIASES = {
    "bags": ("backpack", "rucksack", "bookbag", "school bag", "bag", "purse", "tote", "handbag"),
    "bottles": ("water bottle", "hydro flask", "flask", "thermos", "bottle", "drinkware", "tumbler"),
    "electronics": ("airpods", "earbuds", "earphones", "headphones", "charger", "laptop", "phone", "tablet", "electronics"),
    "keys": ("keychain", "key ring", "keys", "key"),
    "clothing": ("hoodie", "jacket", "coat", "shirt", "sweater", "hat", "clothing"),
    "wallets": ("wallet", "cardholder", "card holder"),
    "shoes": ("sneakers", "trainers", "shoes", "shoe", "boots"),
}

COLOR_ALIASES = {"grey": "gray", "navy blue": "blue", "light blue": "blue", "dark blue": "blue"}


def normalize_words(text):
    """Lowercase and tokenize a value safely."""
    return set(re.findall(r"[a-z0-9]+", str(text or "").lower()))


def similarity(text1, text2):
    """Legacy helper: string similarity on a 0–1 scale."""
    if not text1 or not text2:
        return 0.0
    return SequenceMatcher(None, str(text1).lower(), str(text2).lower()).ratio()


def _clean(value):
    return " ".join(re.findall(r"[a-z0-9]+", str(value or "").lower()))


def _values(value):
    if isinstance(value, list):
        return [str(x) for x in value if x is not None]
    return [str(value)] if value else []


def _category(item):
    # Gemini sometimes calls the same object "school bag" or "backpack".
    # Prefer the analyzed object category; use title/description as fallback.
    primary = _clean(item.get("category"))
    secondary = _clean(item.get("title")) + " " + _clean(item.get("description"))
    for source in (primary, secondary):
        for family, aliases in CATEGORY_ALIASES.items():
            if any(re.search(r"\b" + re.escape(alias) + r"\b", source) for alias in aliases):
                return family
    return primary or "unknown"


def _color(item):
    color = _clean(item.get("color"))
    return COLOR_ALIASES.get(color, color)


def _brand(item):
    brand = _clean(item.get("brand"))
    return "" if brand in ("none", "unknown", "n a", "not visible", "unbranded") else brand


def _feature_phrases(item):
    """Extract detail phrases, including user description when Gemini misses one."""
    phrases = [_clean(x) for x in _values(item.get("distinctive_features"))]
    phrases += [_clean(x) for x in _values(item.get("keywords"))]
    phrases = [p for p in phrases if p]

    # Look for strong everyday identifying details in free-text descriptions.
    desc = _clean(" ".join([str(item.get("title") or ""), str(item.get("description") or "")]))
    identifiers = ("keychain", "sticker", "patch", "scratch", "dent", "tag", "charm", "strap", "zipper", "logo")
    for identifier in identifiers:
        for match in re.finditer(r"\b" + identifier + r"s?\b", desc):
            pre = desc[:match.start()].split()
            phrase = " ".join(pre[-2:] + [identifier])
            phrases.append(phrase)
    return list(dict.fromkeys(phrases))


def get_features(item):
    """Legacy helper: set of words across keywords and distinctive details."""
    words = set()
    for phrase in _feature_phrases(item):
        words.update(normalize_words(phrase))
    return words


def _distinctive_score(a, b):
    """Return a 0–1 feature score and whether there is a strong contradiction."""
    pa, pb = _feature_phrases(a), _feature_phrases(b)
    if not pa or not pb:
        return 0.0, False

    # More weight on distinct details than generic words such as 'bag'.
    def tokens(phrases):
        return set().union(*(normalize_words(p) for p in phrases))

    wa, wb = tokens(pa), tokens(pb)
    meaningful_a, meaningful_b = wa - STOP_WORDS, wb - STOP_WORDS
    if meaningful_a and meaningful_b:
        overlap = len(meaningful_a & meaningful_b) / min(len(meaningful_a), len(meaningful_b))
    else:
        overlap = 0.0

    # A phrase can match when one report is much shorter, e.g. 'red keychain'
    # vs 'small red plastic keychain'.
    phrase_overlap = 0.0
    for x in pa:
        for y in pb:
            xw, yw = normalize_words(x), normalize_words(y)
            if xw and yw:
                phrase_overlap = max(phrase_overlap, len(xw & yw) / min(len(xw), len(yw)))

    # Treat mismatched explicitly described colors for the SAME accessory
    # as a conflict. A missing detail is not a conflict.
    contradiction = False
    colors = {"red", "blue", "green", "yellow", "black", "white", "pink", "purple", "orange", "brown", "gray", "grey"}
    for noun in ("keychain", "sticker", "patch", "strap", "tag"):
        def noun_colors(phrases):
            found = set()
            for phrase in phrases:
                if noun in normalize_words(phrase):
                    found |= normalize_words(phrase) & colors
            return {COLOR_ALIASES.get(c, c) for c in found}
        ca, cb = noun_colors(pa), noun_colors(pb)
        if ca and cb and not (ca & cb):
            contradiction = True

    return max(overlap, phrase_overlap * 0.8), contradiction


def _time_score(lost, found):
    try:
        l = datetime.fromisoformat(str(lost["event_time"]).replace("Z", "+00:00"))
        f = datetime.fromisoformat(str(found["event_time"]).replace("Z", "+00:00"))
        hours = (f - l).total_seconds() / 3600
    except (KeyError, ValueError, TypeError):
        return 0.0, False
    # Only compare timestamps that use the same timezone convention.
    if (l.tzinfo is None) != (f.tzinfo is None):
        return 0.0, False
    if 0 <= hours <= 48:
        return (1.0 if hours <= 6 else 0.7), False
    # Later reports may contain approximate times, so don't hard-reject.
    return 0.0, hours < -2 or hours > 168


def calculate_match(lost, found):
    """Compare lost vs found reports; return {'score': 0..100, 'reasons': list}."""
    score, reasons = 0.0, []
    cat_a, cat_b = _category(lost), _category(found)
    if cat_a != "unknown" and cat_b != "unknown":
        if cat_a != cat_b:
            # A categorically different object is not a useful match.
            return {"score": 0.0, "reasons": ["Different object types"]}
        score += 30
        reasons.append("Matching object category")

    color_a, color_b = _color(lost), _color(found)
    if color_a and color_b:
        if color_a == color_b:
            score += 15
            reasons.append("Matching color")
        else:
            score -= 30
            reasons.append("Conflicting reported colors")

    brand_a, brand_b = _brand(lost), _brand(found)
    if brand_a and brand_b:
        if brand_a == brand_b:
            score += 8
            reasons.append("Matching brand")
        else:
            score -= 5  # Image analysis sometimes mistakes a small logo.

    feature, contradiction = _distinctive_score(lost, found)
    score += feature * 32
    if feature >= 0.45 and not contradiction:
        reasons.append("Similar identifying details")
    if contradiction:
        score -= 65
        reasons.append("Conflicting accessory details")

    loc_a, loc_b = _clean(lost.get("location")), _clean(found.get("location"))
    if loc_a and loc_b and loc_a == loc_b:
        score += 10
        reasons.append("Same campus location")

    time, distant = _time_score(lost, found)
    score += 5 * time
    if time:
        reasons.append("Compatible loss and discovery times")
    elif distant:
        score -= 8

    return {"score": round(max(0, min(100, score)), 1), "reasons": reasons}


def find_matches(target_item, all_items):
    """Return up to five credible active opposite-type reports, highest first."""
    matches = []
    for item in all_items:
        if item.get("id") == target_item.get("id"):
            continue
        if item.get("item_type") == target_item.get("item_type"):
            continue
        if item.get("status", "active") != "active":
            continue
        if target_item.get("item_type") == "lost":
            result = calculate_match(target_item, item)
        else:
            result = calculate_match(item, target_item)
        if result["score"] >= 40:
            matches.append({"item": item, **result})
    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches[:5]
