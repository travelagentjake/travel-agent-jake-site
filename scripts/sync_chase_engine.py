#!/usr/bin/env python3
"""js/chase-engine.js is the one rulebook for chasing. The dashboard loads it in the browser and the hourly sweep imports a copy.
Run this after changing the rulebook to refresh the copy: python3 scripts/sync_chase_engine.py"""
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "js" / "chase-engine.js").read_text()
tail = "})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {}));"
assert tail in src
body = src.replace(tail, "})(__root);")
out = "// GENERATED from js/chase-engine.js by scripts/sync_chase_engine.py. Do not edit this copy.\nconst __root = {};\n" + body + "\nexport default __root.TAJChase;\n"
(root / "netlify" / "lib" / "chase-engine.mjs").write_text(out)
print("wrote netlify/lib/chase-engine.mjs")
