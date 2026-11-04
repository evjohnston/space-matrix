"""Shared helpers: paths, item storage, HTTP, dates."""
import datetime as dt
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
ITEMS_DIR = os.path.join(DATA, "items")
CHANGELOG = os.path.join(DATA, "changelog.json")
WATCHLIST = os.path.join(DATA, "watchlist.json")
STATE = os.path.join(DATA, "state.json")
CONFIG = os.path.join(DATA, "config.json")

USER_AGENT = "space-matrix-tracker/1.0"


def _load_dotenv():
    """Load KEY=VALUE lines from .env (local runs); real env vars take precedence."""
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()


def now_iso():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today():
    return dt.date.today().isoformat()


def slugify(text, maxlen=60):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if len(s) > maxlen:
        s = s[:maxlen + 1].rsplit("-", 1)[0]
    return s or "item"


def read_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, path)


def load_items():
    items = []
    for name in sorted(os.listdir(ITEMS_DIR)):
        if name.endswith(".json"):
            items.append(read_json(os.path.join(ITEMS_DIR, name)))
    return items


def save_item(item):
    write_json(os.path.join(ITEMS_DIR, item["id"] + ".json"), item)


def load_config():
    return read_json(CONFIG, {})


import threading
_throttle_lock = threading.Lock()
_last_call = [0.0]
CONGRESS_MIN_INTERVAL = float(os.environ.get("CONGRESS_MIN_INTERVAL", "0.74"))  # ~4,800/hr, under the 5,000/hr key limit


def _throttle(url):
    if "api.congress.gov" not in url:
        return
    with _throttle_lock:
        wait = _last_call[0] + CONGRESS_MIN_INTERVAL - time.time()
        if wait > 0:
            time.sleep(wait)
        _last_call[0] = time.time()


def http_json(url, params=None, retries=4):
    if params:
        url = url + ("&" if "?" in url else "?") + urllib.parse.urlencode(params, doseq=True)
    last = None
    for attempt in range(retries):
        _throttle(url)
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 404:
                raise
            if e.code == 429:  # hourly key limit: back off hard
                time.sleep(60 * (attempt + 1))
                continue
            if e.code in (500, 502, 503, 504):
                time.sleep(2 ** attempt * 3)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
            time.sleep(2 ** attempt * 3)
    raise last


def congress_api_key():
    return os.environ.get("CONGRESS_API_KEY") or "DEMO_KEY"


def parse_us_date(s):
    """'09/29/2025', '8/20/26', '2026-01-15' -> ISO date string, or '' if unparseable."""
    s = (s or "").strip()
    if not s:
        return ""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return s[:10]
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
    if not m:
        return ""
    mo, d, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 100:
        y += 2000
    try:
        return dt.date(y, mo, d).isoformat()
    except ValueError:
        return ""
