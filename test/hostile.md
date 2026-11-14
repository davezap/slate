# Hostile Markdown

Plain script: <script>window.__pwned='script'</script>

Image onerror: <img src=x onerror="window.__pwned='img'">

Tag with attributes: <b onclick="window.__pwned='b'">bold</b> and <i style="x">i</i>

SVG: <svg onload="window.__pwned='svg'"></svg> <iframe src="javascript:window.__pwned='iframe'"></iframe>

Links: [plain](javascript:window.__pwned='link') [upper](JAVASCRIPT:window.__pwned='upper') [space]( javascript:alert(1)) [tab](java&#9;script:window.__pwned='tab') [newline](java&#10;script:window.__pwned='nl') [entity](&#106;avascript:window.__pwned='ent') [control](&#1;javascript:window.__pwned='ctl') [vb](vbscript:msgbox(1)) [data](data:text/html,<script>window.__pwned='data'</script>)

Images: ![a](javascript:window.__pwned='imgjs') ![b](data:text/html;base64,PHNjcmlwdD4=) ![c](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+)

Quote break: [x](https://a.example/"onmouseover="window.__pwned='attr') ![y](https://a.example/x.png "t\" onerror=\"window.__pwned='title'")

Code: `<script>window.__pwned='code'</script>`

Wiki: [[<img src=x onerror=window.__pwned='wiki'>]]

| <img src=x onerror=window.__pwned='cell'> | b |
| --- | --- |
| [c](javascript:window.__pwned='cell2') | d |

- [ ] <script>window.__pwned='task'</script>

```mermaid
graph TD
A["<img src=x onerror=window.__pwned='mermaid'>"] --> B
click A "javascript:window.__pwned='mclick'"
```

Raw control: [c1](javascript:window.__pwned='c1') [c2](javascript:window.__pwned='c2') ![c3](javascript:window.__pwned='c3')

Embeds that aren't the edition's stay code:

```embed
<img src=x onerror="window.__pwned='embed'">
```

```embed
__proto__
```
