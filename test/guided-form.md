---
form: damage-report
title: Damage report
submitTo: dave/reports/
---

# Report

Reported by: {{text name=reporter default=@name}} ({{email name=contact default=@email}})

Date: {{date name=day default=@today}} at {{time name=at default=@now}}

Workshop: {{select name=workshop default="Workshop A"}}
- Workshop A
- Workshop B

Damaged? {{yesno name=damaged required default=No}}

What is damaged?
{{textarea name=details required show-if="damaged=Yes"}}
Cost: {{number name=cost min=0}}

Parts: {{choice name=parts multi default="Board|Case" show-if=damaged=Yes}}
- [ ] Board
- [ ] Case
- [ ] Screen

Manager: {{text name=manager required show-if="cost>=500"}}

- Screen serial: {{text name=serial show-if="parts=Screen"}}
- Always asked: {{text name=note}}

Phone instead: {{phone name=phone show-if=!contact}}
