#!/usr/bin/env python3
"""Delete customer quotes more than 90 days after they were created.

Removes quotes/<slug>/ and the matching entry in quotes/quotes.json.
Run with --dry-run to see what would go. Only touches the quotes folder,
so it never triggers a Netlify build (Cloudflare Pages redeploys instead).
"""
import json, shutil, sys, datetime, pathlib

MAX_AGE_DAYS = 90
root = pathlib.Path(__file__).resolve().parent.parent
reg_path = root / "quotes" / "quotes.json"
dry = "--dry-run" in sys.argv
today = datetime.date.today()

reg = json.loads(reg_path.read_text())
keep, gone = [], []
for q in reg.get("quotes", []):
    slug = q.get("slug", "")
    try:
        made = datetime.date.fromisoformat(str(q.get("created", ""))[:10])
    except ValueError:
        keep.append(q)          # no usable date: never delete
        continue
    if slug and (today - made).days > MAX_AGE_DAYS:
        gone.append(q)
    else:
        keep.append(q)

if not gone:
    print("Nothing to delete.")
    sys.exit(0)

for q in gone:
    folder = (root / "quotes" / q["slug"]).resolve()
    assert folder.parent == (root / "quotes").resolve() and folder.name not in ("assets", ""), folder
    print(("Would delete " if dry else "Deleting ") + q["slug"] + " (created " + str(q.get("created")) + ")")
    if not dry and folder.is_dir():
        shutil.rmtree(folder)

if not dry:
    reg["quotes"] = keep
    reg_path.write_text(json.dumps(reg, indent=2, ensure_ascii=False) + "\n")
