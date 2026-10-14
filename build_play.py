"""Builds play.html (double-click to run) from BnWGame.jsx, so the component stays the single source of truth.
Usage: python build_play.py
"""
import pathlib, re

here = pathlib.Path(__file__).parent
src = (here / "BnWGame.jsx").read_text(encoding="utf-8")
src = re.sub(r"^import React.*?;\s*$", "const { useCallback, useEffect, useMemo, useRef, useState } = React;", src, count=1, flags=re.M)
src = src.replace("export default function", "function").replace("export const", "const")
src = src.replace("</script", "<\\/script")

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BnW</title>
<style>html,body,#root{{margin:0;height:100%;background:#000}}</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.24.7/babel.min.js"></script>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react">
{src}
ReactDOM.createRoot(document.getElementById('root')).render(<BnWGame />);
</script>
</body>
</html>
"""
(here / "play.html").write_text(html, encoding="utf-8")
print("wrote play.html")
