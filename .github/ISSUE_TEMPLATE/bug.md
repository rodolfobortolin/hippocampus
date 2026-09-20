---
name: Something is not being measured
about: A source is empty, a number looks wrong, or the app will not start
labels: bug
---

**What you expected to see, and what you saw instead**

**macOS version**

**Is "Hipocampo Focus" enabled under Privacy & Security → Accessibility?**
(If it is not even listed, run `npm run build:native` then `npm run permissao`.)

**What does the bottom left of the sidebar say?**
It names any source that is waiting on a permission.

**Tail of the log**
```
tail -40 ~/Library/Logs/Hipocampo/collector.log
```

Please do not attach your database. It is your day, and it is never needed to
diagnose anything.
