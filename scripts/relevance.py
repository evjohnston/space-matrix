"""Explainable 0-100 relevance score for space-sustainability bills and rules.

Every point awarded or deducted is returned as a (points, reason) pair so the
site can show *why* something scored the way it did, and so noisy matches are
easy to spot. Tune weights here; tiers are at the bottom.
"""
import re

STRONG = [  # unambiguously space-related phrases
    r"outer space", r"spacecraft", r"satellites?", r"orbit(?:al|s|ing)?", r"space ?stations?", r"space ?launch(?:es)?",
    r"launch vehicles?", r"cislunar", r"lunar", r"moon", r"mars", r"astronauts?", r"nasa",
    r"national aeronautics and space administration", r"space ?force", r"space traffic", r"space situational awareness",
    r"space domain awareness", r"space commerce", r"commercial space", r"spaceports?", r"space weather",
    r"geostationary", r"low[- ]earth orbit", r"space exploration", r"space (?:systems?|industry|activities|operations?|policy|technology|program)",
    r"office of space commerce", r"aerospace", r"launch (?:and|or) re-?entry", r"launch operators?", r"launch sites?",
    r"part 450", r"space (?:activit\w*|objects?|operators?)", r"novel space", r"space bureau",
]
SUSTAIN = [  # the matrix's focus: safety & sustainability of the space environment
    r"debris", r"sustainab\w*", r"traffic (?:coordination|management)", r"situational awareness", r"de-?orbit\w*",
    r"collisions?", r"conjunctions?", r"remediation", r"end[- ]of[- ]life", r"decommission\w*", r"space safety",
    r"spectrum", r"mission authorization", r"licens\w*",
]
NOISE = [  # contexts where "space" means something else
    r"air ?space", r"office space", r"open spaces?", r"green ?spaces?", r"parking spaces?", r"work ?spaces?",
    r"living spaces?", r"public spaces?", r"retail space", r"storage space", r"space[- ]available", r"breathing space",
    r"safe spaces?", r"crawl ?space", r"cyber ?space", r"outdoor spaces?", r"commercial office", r"leased space",
    r"sunshine act", r"hazardous materials", r"open commission meeting", r"meetings?", r"privacy act",
    r"information collections?", r"paperwork reduction", r"patent licen\w*", r"exclusive licen\w*",
    r"federal acquisition regulation", r"royalt\w*", r"satellite (?:carriers?|radio|television|home viewer\w*)",
    r"(?:prison|prisoner|offender|community|workforce) re-?entry", r"re-?entry (?:resource|program|services|of offenders)",
]
AMBIGUOUS = [r"space", r"launch(?:es|ing)?", r"re-?entry"]  # space-ish words that need confirmation
SPACE_SUBJECTS = {"Space flight and exploration", "Spacecraft and satellites"}
RELATED_SUBJECTS = {"Radio spectrum allocation", "Aviation and airports", "Telecommunication rates and fees",
                    "Advanced technology and technological innovations", "Military space and missile defense",
                    "Satellite communications", "Weather and climate"}
POLICY_AREAS = {"Science, Technology, Communications": 10, "Armed Forces and National Security": 4,
                "Transportation and Public Works": 4, "Commerce": 3}
SPACE_COMMITTEES = {"hssy16": 20, "sscm33": 20, "sscm24": 20, "sscm17": 20, "sscm05": 20,
                    "hssy00": 6, "sscm00": 4, "hsas29": 6, "ssas16": 6}
SUBCOMMITTEES = ["hssy16", "sscm33", "sscm24", "sscm17", "sscm05", "hsas29", "ssas16"]  # scanned for every Congress
SPACE_AGENCIES = {"national aeronautics and space administration": 15, "commercial space transportation": 15,
                  "office of space commerce": 15, "space": 10}

_strong = re.compile(r"\b(" + "|".join(STRONG) + r")\b", re.I)
_sustain = re.compile(r"\b(" + "|".join(SUSTAIN) + r")\b", re.I)
_noise = re.compile(r"\b(" + "|".join(NOISE) + r")\b", re.I)
_space_word = re.compile(r"\b(" + "|".join(AMBIGUOUS) + r")\b", re.I)

# Loose pre-filter: anything that *might* be relevant gets fetched and scored.
PREFILTER = re.compile(r"\b(" + "|".join(STRONG + AMBIGUOUS + [r"debris", r"spectrum"]) + r")\b", re.I)

NAME2CODE = {"Space and Aeronautics Subcommittee": "hssy16", "Aviation, Space, and Innovation Subcommittee": "sscm33",
             "Space, Science, and Competitiveness Subcommittee": "sscm24", "Science and Space Subcommittee": "sscm17",
             "Science, Technology, and Space Subcommittee": "sscm05",
             "Science, Space, and Technology Committee": "hssy00", "Commerce, Science, and Transportation Committee": "sscm00",
             "Strategic Forces Subcommittee": "hsas29"}

TIERS = [(70, "High"), (45, "Medium"), (25, "Low"), (0, "Likely noise")]


def tier(score):
    for floor, name in TIERS:
        if score >= floor:
            return name
    return TIERS[-1][1]


def _uniq(matches):
    out = []
    for m in matches:
        m = m.lower()
        if m not in out:
            out.append(m)
    return out


def score(title="", summary="", subjects=(), policy_area="", committees=(), agencies=(), doc_type=""):
    reasons = []
    title = title or ""
    summary = summary or ""

    strong_t = _uniq(_strong.findall(title))
    noise_t = _uniq(_noise.findall(title))
    if strong_t:
        reasons.append((35, "Title mentions " + ", ".join("“%s”" % w for w in strong_t[:3])))
    elif _space_word.search(_noise.sub("", title)):
        w = _space_word.search(_noise.sub("", title)).group(0).lower()
        reasons.append((12, "Title says “%s” (ambiguous on its own)" % w))
    if noise_t:
        reasons.append((-30, "Title has a non-space context: " + ", ".join("“%s”" % w for w in noise_t[:2])))

    subj = set(subjects or ())
    hits = sorted(subj & SPACE_SUBJECTS)
    if hits:
        reasons.append((30 + 10 * (len(hits) - 1), "Official subject: " + "; ".join(hits)))
    rel = sorted(subj & RELATED_SUBJECTS)
    if rel:
        reasons.append((5, "Related subject: " + "; ".join(rel[:2])))

    for code in committees or ():
        if code in SPACE_COMMITTEES:
            reasons.append((SPACE_COMMITTEES[code], "Referred to " + COMMITTEE_NAMES.get(code, code)))

    ag = " ".join(agencies or ()).lower()
    for key, pts in SPACE_AGENCIES.items():
        if key in ag and not noise_t:
            reasons.append((pts, "Issuing agency is space-focused"))
            break

    strong_s = _strong.findall(summary)
    is_doc = bool(doc_type)  # Federal Register titles are terse; the abstract carries the subject
    word = "Abstract" if is_doc else "Summary"
    if len(strong_s) >= 3:
        reasons.append((30 if is_doc else 15, "%s repeatedly discusses space (%d mentions)" % (word, len(strong_s))))
    elif strong_s:
        reasons.append((20 if is_doc else 7, "%s mentions " % word + ", ".join("“%s”" % w for w in _uniq(strong_s)[:2])))
    if _noise.search(summary) and not strong_s:
        reasons.append((-10, "%s uses “space” in a non-space sense" % word))

    ambiguous_title = not strong_t and not noise_t and _space_word.search(title)
    admin = bool(noise_t)  # boilerplate/admin documents shouldn't get the agency bonus
    confirmed = strong_s or hits or any(code in SPACE_COMMITTEES for code in committees or ()) or ag
    if ambiguous_title and confirmed:
        reasons.append((15, "Title term confirmed as space-related by the summary, subjects or committee"))

    has_space = sum(p for p, _ in reasons if p > 0) >= 20
    sus = _uniq(_sustain.findall(title + " " + summary))
    if sus and has_space:
        reasons.append((10 if len(sus) == 1 else 15, "Sustainability/safety terms: " + ", ".join(sus[:3])))

    if has_space and policy_area in POLICY_AREAS:
        reasons.append((POLICY_AREAS[policy_area], "Policy area: " + policy_area))
    if has_space and doc_type in ("Rule", "Proposed Rule"):
        reasons.append((8, "Binding rulemaking (%s)" % doc_type.lower()))

    total = max(0, min(100, sum(p for p, _ in reasons)))
    return {"score": total, "tier": tier(total), "reasons": [[p, r] for p, r in reasons]}


COMMITTEE_NAMES = {
    "hssy16": "House Space and Aeronautics Subcommittee", "sscm33": "Senate Aviation, Space, and Innovation Subcommittee",
    "sscm24": "Senate Space, Science, and Competitiveness Subcommittee", "sscm17": "Senate Science and Space Subcommittee",
    "sscm05": "Senate Science, Technology, and Space Subcommittee",
    "hssy00": "House Science, Space, and Technology Committee", "sscm00": "Senate Commerce, Science, and Transportation Committee",
    "hsas29": "House Strategic Forces Subcommittee", "ssas16": "Senate Strategic Forces Subcommittee",
}
