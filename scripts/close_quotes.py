#!/usr/bin/env python3
"""Take away the pages of quotes Jake has closed in the dashboard (and bring back ones he has reopened).

Asks the live site for the list of closed quote links, then replaces quotes/<slug>/index.html with a bare
"no longer available" page that holds no holiday details. The old page stays in git history.
If a quote is no longer closed, the last real page is restored from history.
Run with --dry-run to see what would change. Only touches the quotes folder, so it never triggers a Netlify build.
"""
import json, re, subprocess, sys, pathlib, urllib.request

MARK = "taj-closed-stub"
root = pathlib.Path(__file__).resolve().parent.parent
qdir = root / "quotes"
dry = "--dry-run" in sys.argv
req = urllib.request.Request("https://travelagentjake.co.uk/api/quote-config?closed=1", headers={"User-Agent": "taj-close-quotes"})
closed = set(json.load(urllib.request.urlopen(req, timeout=30)).get("closed", []))
closed = {s for s in closed if re.fullmatch(r"[a-z0-9][a-z0-9-]{0,39}", s)}

STUB = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="{mark}" content="1">
<title>This quote is no longer available | Travel Agent Jake</title>
<style>body{{margin:0;font-family:Archivo,Arial,sans-serif;background:#fff;color:#10142B}}main{{max-width:520px;margin:12vh auto;padding:0 20px;text-align:center}}h1{{color:#004AAD;font-size:26px;margin:0 0 12px}}p{{font-size:17px;line-height:1.5;margin:0 0 20px}}a{{display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:999px}}</style>
</head><body><main><h1>This quote is no longer available</h1>
<p>Quotes are only kept open for a limited time. If you are still thinking about this holiday, message Jake and he will gladly look at it again for you.</p>
<a href="https://wa.me/447899290262?text=Hi%20Jake%2C%20I%20was%20looking%20at%20my%20holiday%20quote%20and%20it%20has%20closed.%20Could%20you%20help%20me%20please%3F">Message Jake on WhatsApp</a></main>
<script>(function(){{try{{if(localStorage.getItem('taj-jake')==='1'||/[?&]jake/.test(location.search))return;}}catch(e){{}}
var b=JSON.stringify({{slug:"{slug}",ref:(document.referrer||"").slice(0,200)}}),u="https://travelagentjake.co.uk/api/quote-view";
try{{if(navigator.sendBeacon&&navigator.sendBeacon(u,new Blob([b],{{type:"text/plain"}})))return;}}catch(e){{}}
try{{fetch(u,{{method:"POST",body:b,mode:"no-cors",keepalive:true}});}}catch(e){{}}}})();</script>
</body></html>
"""

def git(*a):
    return subprocess.run(["git", *a], cwd=root, capture_output=True, text=True)

changed = 0
for d in sorted(qdir.iterdir()):
    if not d.is_dir() or d.name == "assets":
        continue
    f = d / "index.html"
    if not f.is_file():
        continue
    is_stub = MARK in f.read_text(errors="ignore")[:2000]
    if d.name in closed and not is_stub:
        print(("Would close " if dry else "Closing ") + d.name)
        if not dry:
            f.write_text(STUB.format(mark=MARK, slug=d.name))
        changed += 1
    elif d.name not in closed and is_stub:
        rel = f"quotes/{d.name}/index.html"
        sha = git("log", "-1", "--format=%H", "--", rel).stdout.strip()   # the commit that wrote the stub
        prev = git("log", "-1", "--format=%H", f"{sha}^", "--", rel).stdout.strip() if sha else ""
        print(("Would reopen " if dry else "Reopening ") + d.name + (" from " + prev[:7] if prev else " (no history found, left as is)"))
        if prev and not dry:
            old = git("show", f"{prev}:{rel}").stdout
            if old and MARK not in old[:2000]:
                f.write_text(old)
                changed += 1
print(f"{changed} change(s).")
