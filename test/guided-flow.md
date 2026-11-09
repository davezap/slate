---
form: bench-check
title: Bench check
submitTo: dave/reports/
autoFlow: true
---

Fill this in at the bench.

## 1. The board

Serial number: {{text name=serial required}}

Board revision: {{select name=rev required}}
- A
- B

## 2. Power

Does it power on? {{yesno name=power required}}

What happens instead?
{{textarea name=fault required show-if="power=No"}}

## 3. Sign off

Notes: {{textarea name=notes}}
