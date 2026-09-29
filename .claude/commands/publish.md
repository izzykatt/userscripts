---
description: Take a script from "changed" to "posted on Sleazy Fork", with every gate in order.
argument-hint: <script-name> [patch|minor|major|x.y.z]
allowed-tools: Bash, Read, Edit, Glob, Grep
---

Publish `$1` at bump level `${2:-patch}`.

Do these in order and **stop at the first failure** — report what failed and
what you need, rather than working around it.

1. **Confirm the change is real and measured.** `git diff` the script. If a
   selector changed, the header comment must carry the new measurement and its
   date. A comment asserting behaviour the code does not perform is a defect —
   fix the comment in this same change, not later.

2. **Bump the version.**
   `nix run .#bump -- $1 ${2:-patch}`
   Never hand-edit the `@version` line; the command preserves the metadata
   block's alignment and refuses anything that does not clear `origin/main`.

3. **Write the CHANGELOG entry** under `## $1`, newest first, in Keep a
   Changelog categories (`Added`/`Changed`/`Fixed`/`Removed`/`Security`).
   Explain **why**, and include the measurement. "What" is in the diff.

4. **Update `listings/$1.md`** if the behaviour changed. It is the Sleazy Fork
   body, and an undisclosed behaviour is the most common reason a script is
   taken down. Render any diagram with `nix run .#diagram`.

5. **Run the gates.** `nix run .#lint`, then
   `nix run .#publish-check -- $1`. Every line must read `ok`.

   Then check it on a real page:
   `nix run .#verify -- <a page the script targets> --expect <its html attribute>`
   That drives a real wheel event, so lazy content is measured rather than
   assumed absent.

6. **Exercise the site's primary actions** in a browser before you call it
   done. Geometry proves a control is *present*, never that it *works* — and
   it must work under a **trusted** event (CDP `Input.dispatchMouseEvent`, not
   `el.click()`). CLAUDE.md § Measuring the live page has the tooling and the
   injection traps; there are no acceptance specs in this repo yet, so this
   step is manual and you must actually do it.

7. **Branch, commit, push.** Subject `$1: what changed`; the body explains why
   and carries the measurement. Never add AI attribution. Push the branch —
   the **izzykatt-ci** App opens the pull request from that commit message and
   squash-merges it once the checks are green.

8. **Report what is left for a human**: posting the code and the listing body
   on Sleazy Fork (select **Markdown** before pasting the body — a missed click
   publishes raw `##` and fences), and adding the listing link to the README
   catalogue row if this is a first publish.
