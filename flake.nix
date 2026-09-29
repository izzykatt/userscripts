# The whole toolchain for developing, linting and publishing these userscripts.
#
#   nix develop              every CLI this repository needs, pinned
#   nix run .#toolkit        list every command
#   nix run .#lint           both publish gates (eslint + meta-lint)
#   nix flake check          every gate that can run OFFLINE, in a sandbox
#
# WHY A FLAKE FOR A REPOSITORY WITH NO BUILD STEP. The scripts are not built —
# that is deliberate and must stay true (see CONTRIBUTING.md § Repository
# shape). What IS built is the judgement around them: eight linters, a
# Greasy Fork publish-readiness checker, a Go renderer that produces the ASCII
# diagrams in listings/*.md, and a `@version` bump whose rules have bitten this
# project more than once. Every one of those is a tool that has to be the SAME
# version for the maintainer, for CI, and for whoever clones this next. That is
# what is pinned here.
#
# THE ONE THING NOT PINNED BY NIX: eslint and eslint-plugin-userscripts come
# from npm, because neither is packaged in nixpkgs (checked 2026-09-28). They
# are still deterministic — `importNpmLock` builds node_modules straight from
# package-lock.json, using the integrity hash already recorded there for every
# tarball. So there is no `npm install` anywhere in this flake, and no network
# access during a check.
{
  description = "userscripts — dev, lint and publish toolkit for izzykatt/userscripts";

  # ONE input on purpose. This repository is cloned by people who do not run
  # this fleet, and every extra input is another thing that can fail to fetch
  # for them. flake-parts would buy nothing here: the outputs are flat.
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      inherit (nixpkgs) lib;
      fs = lib.fileset;

      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      # A NARROW unfree allowance, never a blanket one. Chrome for Testing is a
      # Google binary under Chrome's terms, so nixpkgs refuses it by default —
      # and a public repository must not require a contributor to set
      # allowUnfree globally just to get a dev shell. The predicate names
      # exactly one package; everything else stays refused, google-chrome
      # included.
      pkgsFor =
        system:
        import nixpkgs {
          inherit system;
          config.allowUnfreePredicate = p: lib.getName p == "chrome-for-testing";
        };
      forAll = f: lib.genAttrs systems (system: f system (pkgsFor system));

      # Packages that are not commands. They stay out of `apps`, and `browser`
      # stays out of `checks` too — it is a 361 MB download, and a gate that
      # fetches a browser is not a gate anybody runs twice.
      nonApps = [
        "mermaid-ascii"
        "chromium"
        "violentmonkey"
      ];

      # ── Env catalogue ────────────────────────────────────────────────────
      # This repository reads NO environment variable at runtime — the scripts
      # run in a browser. Everything here is tooling or CI, and the catalogue
      # exists so the two credentials .github/workflows/automerge.yml depends
      # on are written down somewhere other than inside the YAML that uses
      # them. `env-doctor` is generated from it, so the two cannot drift.
      #
      # need   : required | optional | ci | local
      # secret : true → tooling reports PRESENCE ONLY, never the value
      envCatalogue = {
        GH_TOKEN = {
          need = "optional";
          secret = true;
          note = "gh CLI. Only needed past the anonymous rate limit; `gh auth login` is the normal path.";
        };
        GITHUB_TOKEN = {
          need = "optional";
          secret = true;
          note = "Alias gh also accepts. Set one or the other, never both.";
        };
        CI_APP_CLIENT_ID = {
          need = "ci";
          secret = false;
          note = "Repository VARIABLE (vars.*), not a secret. izzykatt-ci App. Expected MISSING locally.";
        };
        CI_APP_PRIVATE_KEY = {
          need = "ci";
          secret = true;
          note = "Repository SECRET. izzykatt-ci App private key. Expected MISSING locally.";
        };
        PROJECT_ROOT = {
          need = "local";
          secret = false;
          note = "Overrides the git-toplevel guess every command makes. Rarely needed.";
        };
      };

      envNames = lib.attrNames envCatalogue;
      envTsv = lib.concatMapStringsSep "\n" (
        n:
        let
          e = envCatalogue.${n};
        in
        lib.concatStringsSep "\t" [
          n
          e.need
          (if e.secret then "secret" else "plain")
          (e.note or "")
        ]
      ) envNames;

      # ── Source filesets ──────────────────────────────────────────────────
      # Narrow on purpose: a CHANGELOG edit must not rebuild the ESLint check,
      # and a userscript edit must not rebuild the workflow check.
      userscriptFiles = fs.fileFilter (f: lib.hasSuffix ".user.js" f.name) ./.;
      markdownFiles = fs.fileFilter (f: f.hasExt "md") ./.;
      nixFiles = fs.fileFilter (f: f.hasExt "nix") ./.;

      npmSrc = fs.toSource {
        root = ./.;
        fileset = fs.unions [
          ./package.json
          ./package-lock.json
        ];
      };
      eslintSrc = fs.toSource {
        root = ./.;
        fileset = fs.unions [
          userscriptFiles
          ./scripts
          ./.claude/hooks
          ./eslint.config.mjs
          ./package.json
        ];
      };
      metaSrc = fs.toSource {
        root = ./.;
        fileset = fs.unions [
          userscriptFiles
          ./scripts
        ];
      };
      parseSrc = fs.toSource {
        root = ./.;
        fileset = userscriptFiles;
      };
      workflowSrc = fs.toSource {
        root = ./.;
        fileset = ./.github;
      };
      markdownSrc = fs.toSource {
        root = ./.;
        fileset = fs.unions [
          markdownFiles
          ./.markdownlint.jsonc
          ./.markdownlint-cli2.jsonc
          ./listings/.markdownlint.jsonc
          ./.github/.markdownlint.jsonc
          ./.claude/.markdownlint.jsonc
        ];
      };
      nixSrc = fs.toSource {
        root = ./.;
        fileset = nixFiles;
      };
    in
    {
      # nixfmt-tree, not bare nixfmt: it is the treefmt wrapper, so `nix fmt`
      # takes a directory. Plain `nixfmt .` is deprecated and due to stop working.
      formatter = forAll (_: pkgs: pkgs.nixfmt-tree);

      packages = forAll (
        system: pkgs:
        let
          nodejs = pkgs.nodejs_22;

          # node_modules built from package-lock.json, offline. Every tarball
          # is a fixed-output derivation keyed on the `integrity` hash already
          # in the lockfile, so this needs no extra hash to maintain and no
          # `npm install` to reproduce.
          nodeModules = pkgs.importNpmLock.buildNodeModules {
            inherit nodejs;
            npmRoot = npmSrc;
          };

          mermaid-ascii = pkgs.callPackage ./nix/mermaid-ascii.nix { };

          # Google publishes Chrome for Testing for mac-arm64, mac-x64 and
          # linux64 — and NOT for aarch64-linux, where nixpkgs' own chromium
          # does build. One name, the best available build behind it.
          chromiumPkg =
            if system == "aarch64-linux" then
              pkgs.chromium
            else
              pkgs.callPackage ./nix/chrome-for-testing.nix { };

          violentmonkeyPkg = pkgs.callPackage ./nix/violentmonkey.nix { };

          # The trailing newline is load-bearing: `while IFS= read` drops a
          # final line that has none, which silently hid the last variable.
          envTsvFile = pkgs.writeText "userscripts-env-catalogue.tsv" (envTsv + "\n");

          # Shared by every command. `export` rather than plain assignment
          # because each command uses only part of it, and shellcheck (which
          # writeShellApplication runs at BUILD time) flags an unused local.
          prelude = ''
            PRJ="''${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
            export PRJ
            cd "$PRJ"

            NODE_MODULES_STORE="${nodeModules}/node_modules"
            export NODE_MODULES_STORE

            # Point ./node_modules at the flake-pinned tree, WITHOUT destroying
            # an npm-installed one. Both resolve the same versions (they come
            # from the same lockfile), so either is correct — this only makes
            # the fast path available with no `npm install`.
            _link_node_modules() {
              if [ -L node_modules ] && [ "$(readlink node_modules)" = "$NODE_MODULES_STORE" ]; then
                return 0
              fi
              if [ -e node_modules ] && [ ! -L node_modules ]; then
                echo "note: node_modules/ is an npm-installed directory; using it as-is." >&2
                echo "      for the flake-pinned tree instead: nix run .#deps" >&2
                return 0
              fi
              ln -sfn "$NODE_MODULES_STORE" node_modules
            }

            # Strict "greater than" over dotted-numeric versions. Exit 0 = a > b.
            _vgt() {
              awk -v a="$1" -v b="$2" 'BEGIN {
                n = split(a, x, "."); m = split(b, y, ".");
                k = (n > m ? n : m);
                for (i = 1; i <= k; i++) {
                  ai = (i <= n ? x[i] + 0 : 0); bi = (i <= m ? y[i] + 0 : 0);
                  if (ai > bi) exit 0;
                  if (ai < bi) exit 1;
                }
                exit 1
              }'
            }

            # Accept "thumbwall", "thumbwall.user.js" or a path; echo the file.
            _script_file() {
              case "$1" in
                *.user.js) printf '%s\n' "$1" ;;
                *) printf '%s.user.js\n' "$1" ;;
              esac
            }

            _version_of() {
              sed -n 's|^// @version[[:space:]]\{1,\}\([0-9.]\{1,\}\).*$|\1|p' "$1" | head -1
            }
          '';

          # Shared by `browser` and `watch` so the two can never disagree about
          # which binary, which profile or which port.
          browserPrelude = ''
            PORT="''${USERSCRIPTS_CDP_PORT:-9222}"
            PROFILE="''${USERSCRIPTS_PROFILE:-$PRJ/.nix-browser/profile}"
            # USERSCRIPTS_CHROME is the escape hatch for "test it on the browser
            # I actually have". It is NOT the default, because an installed
            # browser self-updates, and then no measurement note can name a
            # version that still exists.
            BROWSER_BIN="''${USERSCRIPTS_CHROME:-${lib.getExe chromiumPkg}}"
            VM_DIR="${violentmonkeyPkg}"
            # `export`, for the same reason the main prelude exports: `browser`
            # and `watch` share this file and only `watch` reads HOT, so a plain
            # assignment reads as dead to shellcheck (SC2034) and fails the
            # build of the command that does not use it.
            export HOT=""
            HEADLESS=""
            CHROME_ARGS=()
            URLS=()

            _usage() {
              cat <<'USAGE'
            usage: <command> [--violentmonkey] [--hot] [--port N] [--] [url ...]

              --violentmonkey  load the pinned Violentmonkey and verify the way a
                               READER runs it - a real install, with the manager's
                               own update path. Two one-time clicks per profile.
              --hot            watch only: swap the script into the live page with
                               no reload. Fast, but a document-start gate has
                               nothing to gate on an already-painted page.
              --headless       run headless (--headless=new). For a scripted check;
                               you cannot judge a redesign you cannot see.
              --port N         CDP port (default 9222 - the port page-lab's
                               selector-verify.mjs already expects).

            env: USERSCRIPTS_CHROME, USERSCRIPTS_PROFILE, USERSCRIPTS_CDP_PORT
            USAGE
            }

            _parse_browser_args() {
              local vm=0
              while [ $# -gt 0 ]; do
                case "$1" in
                  --violentmonkey) vm=1; shift ;;
                  --hot) HOT=1; shift ;;
                  --headless) HEADLESS=1; shift ;;
                  --port) PORT="$2"; shift 2 ;;
                  -h | --help) _usage; exit 0 ;;
                  --) shift; URLS+=("$@"); break ;;
                  -*) echo "unknown option: $1" >&2; _usage >&2; exit 2 ;;
                  *) URLS+=("$1"); shift ;;
                esac
              done
              CHROME_ARGS=(
                --user-data-dir="$PROFILE"
                --remote-debugging-port="$PORT"
                --no-first-run
                --no-default-browser-check
              )
              # --headless=new, never the old --headless: the old one is a
              # separate, thinner implementation whose rendering and extension
              # support differ from the browser a reader actually runs.
              [ -n "$HEADLESS" ] && CHROME_ARGS+=(--headless=new)
              if [ "$vm" = 1 ]; then
                CHROME_ARGS+=(--disable-extensions-except="$VM_DIR" --load-extension="$VM_DIR")
                echo "[browser] Violentmonkey $VM_DIR"
                echo "[browser] one-time, per profile: chrome://extensions -> Violentmonkey ->"
                echo "[browser]   Details -> Allow access to file URLs, then open the .user.js"
                echo "[browser]   file:// URL and tick 'Track local file' on the install page."
              fi
            }

            _prepare_profile() {
              # A PROJECT-LOCAL profile, always. These scripts target adult sites;
              # pointing a debugger at the operator's real profile would put their
              # own session, cookies and history inside this tool's blast radius.
              mkdir -p "$PROFILE"
            }

            _refuse_if_port_busy() {
              if curl -fsS --max-time 1 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
                echo "something is already answering CDP on $PORT." >&2
                echo "attach to it with 'nix run .#watch', or pick another --port." >&2
                exit 1
              fi
            }
          '';

          mk =
            {
              name,
              deps ? [ ],
              text,
            }:
            pkgs.writeShellApplication {
              inherit name;
              # SC2329 "this function is never invoked": every command shares one
              # prelude and uses only part of it. That is the point of a prelude,
              # not a defect, and shellcheck cannot see the other callers.
              excludeShellChecks = [ "SC2329" ];
              runtimeInputs = deps ++ [
                pkgs.coreutils
                pkgs.gnused
                pkgs.gawk
                pkgs.git
              ];
              text = prelude + text;
            };
        in
        {
          inherit mermaid-ascii;
          chromium = chromiumPkg;
          violentmonkey = violentmonkeyPkg;

          # ── The two publish gates ──────────────────────────────────────
          lint = mk {
            name = "lint";
            deps = [ nodejs ];
            text = ''
              _link_node_modules
              echo "==> eslint"
              "$NODE_MODULES_STORE/.bin/eslint" .
              echo "==> meta-lint"
              node scripts/meta-lint.mjs
            '';
          };

          fix = mk {
            name = "fix";
            deps = [
              nodejs
              pkgs.markdownlint-cli2
            ];
            text = ''
              _link_node_modules
              echo "==> eslint --fix"
              "$NODE_MODULES_STORE/.bin/eslint" . --fix || true
              echo "==> markdownlint-cli2 --fix"
              markdownlint-cli2 --fix || true
              echo
              echo "now run: nix run .#lint"
            '';
          };

          # ── The @version trap, mechanised ──────────────────────────────
          # CONTRIBUTING.md § The `@version` trap is the whole spec for this
          # command. A re-install at an unchanged version is a SILENT no-op,
          # and Violentmonkey never downgrades, so the only safe direction is
          # strictly up — past anything already published.
          bump = mk {
            name = "bump";
            text = ''
              if [ $# -lt 1 ]; then
                echo "usage: bump <script> [patch|minor|major|<x.y.z>]" >&2
                echo "   eg: nix run .#bump -- thumbwall minor" >&2
                exit 2
              fi
              f=$(_script_file "$1")
              [ -f "$f" ] || { echo "no such script: $f" >&2; exit 1; }
              level="''${2:-patch}"

              cur=$(_version_of "$f")
              [ -n "$cur" ] || { echo "$f: no dotted-numeric @version to bump" >&2; exit 1; }

              case "$level" in
                patch | minor | major)
                  new=$(awk -v v="$cur" -v lvl="$level" 'BEGIN {
                    n = split(v, p, ".");
                    ma = p[1] + 0; mi = (n > 1 ? p[2] + 0 : 0); pa = (n > 2 ? p[3] + 0 : 0);
                    if (lvl == "major") { ma++; mi = 0; pa = 0 }
                    else if (lvl == "minor") { mi++; pa = 0 }
                    else { pa++ }
                    printf "%d.%d.%d", ma, mi, pa
                  }')
                  ;;
                *) new="$level" ;;
              esac

              case "$new" in
                "" | *[!0-9.]* | .* | *.)
                  echo "@version must be dotted-numeric — Greasy Fork cannot order \"$new\"" >&2
                  exit 1
                  ;;
              esac

              _vgt "$new" "$cur" || {
                echo "refusing: $new is not greater than the current $cur" >&2
                exit 1
              }

              # Also clear whatever is on origin/main. Two branches can each
              # bump to the same number and both look fine in isolation.
              if git rev-parse --verify --quiet origin/main >/dev/null 2>&1; then
                base=$(git show "origin/main:$f" 2>/dev/null | sed -n 's|^// @version[[:space:]]\{1,\}\([0-9.]\{1,\}\).*$|\1|p' | head -1 || true)
                if [ -n "$base" ] && ! _vgt "$new" "$base"; then
                  echo "refusing: origin/main already has $base; $new does not clear it" >&2
                  exit 1
                fi
              else
                echo "note: no origin/main locally — skipped the published-version check." >&2
              fi

              # Rewrite the VALUE only. The leading run of spaces is the
              # metadata block's enforced alignment (userscripts/align-attributes).
              sed -i -E "s|^(// @version[[:space:]]+).*$|\1$new|" "$f"
              echo "$f: $cur -> $new"
              echo
              echo "next:"
              echo "  1. add the CHANGELOG.md entry under '## ''${f%.user.js}'"
              echo "  2. update listings/''${f%.user.js}.md if the behaviour changed"
              echo "  3. nix run .#publish-check -- ''${f%.user.js}"
            '';
          };

          check-versions = mk {
            name = "check-versions";
            deps = [ nodejs ];
            text = ''
              git fetch --quiet origin main 2>/dev/null || \
                echo "note: could not fetch origin/main; comparing against the local copy." >&2
              node scripts/meta-lint.mjs --versions-against origin/main
            '';
          };

          # ── Everything CONTRIBUTING.md asks for before a listing goes up ──
          publish-check = mk {
            name = "publish-check";
            deps = [ nodejs ];
            text = ''
              if [ $# -lt 1 ]; then
                echo "usage: publish-check <script>" >&2
                exit 2
              fi
              f=$(_script_file "$1")
              name="''${f%.user.js}"
              [ -f "$f" ] || { echo "no such script: $f" >&2; exit 1; }
              ver=$(_version_of "$f")
              bad=0
              ok()   { printf '  ok    %s\n' "$1"; }
              fail() { printf '  FAIL  %s\n' "$1"; bad=$((bad + 1)); }

              echo "publish-check $f @ $ver"

              _link_node_modules
              if "$NODE_MODULES_STORE/.bin/eslint" "$f" >/dev/null 2>&1; then
                ok "eslint clean"
              else
                fail "eslint reports problems — run: nix run .#lint"
              fi

              if node scripts/meta-lint.mjs "$f" >/dev/null 2>&1; then
                ok "meta-lint clean (required keys, banned keys, 500-char cap)"
              else
                fail "meta-lint reports problems — run: nix run .#lint"
              fi

              if git rev-parse --verify --quiet origin/main >/dev/null 2>&1; then
                base=$(git show "origin/main:$f" 2>/dev/null | sed -n 's|^// @version[[:space:]]\{1,\}\([0-9.]\{1,\}\).*$|\1|p' | head -1 || true)
                if [ -z "$base" ]; then
                  ok "new script — nothing published to compare against"
                elif _vgt "$ver" "$base"; then
                  ok "@version $ver clears origin/main's $base"
                elif [ "$ver" = "$base" ]; then
                  fail "@version $ver is already on origin/main — there is nothing new to publish (nix run .#bump -- $name)"
                else
                  fail "@version $ver is BELOW origin/main's $base — Violentmonkey never downgrades"
                fi
              else
                fail "no origin/main locally — cannot check the published version"
              fi

              # The entry must be inside this script's own section, not merely
              # somewhere in a 170 KB file.
              if awk -v s="## $name" -v v="$ver" '
                   $0 == s { inside = 1; next }
                   /^## / { inside = 0 }
                   inside && $0 ~ "^#+ \\[?v?" v "\\]?" { found = 1 }
                   END { exit !found }' CHANGELOG.md; then
                ok "CHANGELOG.md has a $ver entry under '## $name'"
              else
                fail "CHANGELOG.md has no $ver entry under '## $name'"
              fi

              if [ -s "listings/$name.md" ] && [ "$(wc -l < "listings/$name.md")" -ge 20 ]; then
                ok "listings/$name.md exists and is substantive"
              else
                fail "listings/$name.md missing or too thin — Sleazy Fork requires a proper description"
              fi

              if grep -q "$f" README.md; then
                ok "README.md catalogue lists $f"
              else
                fail "README.md catalogue has no row for $f"
              fi

              echo
              if [ "$bad" -gt 0 ]; then
                echo "$bad check(s) failed — do not publish yet."
                exit 1
              fi
              echo "ready to publish. Remember: paste the code, then SELECT MARKDOWN before"
              echo "pasting listings/$name.md — a missed click publishes raw ## and fences."
            '';
          };

          # ── A new install unit, with the repo's design rules pre-wired ──
          new-script = mk {
            name = "new-script";
            deps = [ nodejs ];
            text = ''
              if [ $# -lt 1 ]; then
                echo "usage: new-script <name>        (no .user.js suffix)" >&2
                exit 2
              fi
              name="''${1%.user.js}"
              f="$name.user.js"
              [ -e "$f" ] && { echo "$f already exists" >&2; exit 1; }

              cat > "$f" <<'SCRIPT'
              // ==UserScript==
              // @name         TODO one line, as it appears on the listing
              // @namespace    izzykatt.ca
              // @version      0.1.0
              // @description  TODO what it does, what it deliberately does NOT do, and its limits.
              // @author       Izzy Katt
              // @license      MIT
              // @match        https://example.com/*
              // @homepageURL  https://github.com/izzykatt/userscripts
              // @supportURL   https://github.com/izzykatt/userscripts/issues
              // @run-at       document-start
              // @grant        none
              // @noframes
              // ==/UserScript==

              /* TODO: the measured evidence for every selector below — the date you
                 measured, the node count you confirmed, and why this anchor and not a
                 generated class name. A header comment asserting behaviour the code does
                 not perform is a DEFECT, not stale documentation. */

              (() => {
                const TEARDOWN = '__TODO_teardown';

                /* Teardown contract. Call any previous teardown at entry, and NEVER
                   early-return on an "already initialised" flag — that makes a re-run a
                   silent no-op and hides double-injection bugs. */
                if (typeof window[TEARDOWN] === 'function') window[TEARDOWN]();

                const disposers = [];
                window[TEARDOWN] = () => {
                  while (disposers.length) disposers.pop()();
                  delete window[TEARDOWN];
                };

                /* Failure mode is ALWAYS degrade to stock. arm() gates on the DOM, read
                   fresh each pass — never latched in a variable. When the anchor is
                   renamed upstream this returns false and the page renders as the site
                   intended. */
                const arm = () => {
                  const root = document.querySelector('TODO');
                  return Boolean(root);
                };

                const apply = () => {
                  if (!arm()) return;
                  /* TODO */
                };

                /* childList-only, and never `subtree` on a large or virtualised DOM. */
                const mo = new MutationObserver(apply);
                mo.observe(document.documentElement, { childList: true });
                disposers.push(() => mo.disconnect());

                apply();
              })();
              SCRIPT
              # The heredoc above is indented so it reads correctly inside this
              # file; strip that indentation back off.
              sed -i 's|^              ||' "$f"

              mkdir -p listings
              cat > "listings/$name.md" <<'LISTING'
              ## What it does

              TODO

              ## What it deliberately does NOT do

              TODO — an undisclosed behaviour is the most common reason a script is
              taken down.

              ## Known limits

              TODO

              Source, issues and changelog: https://github.com/izzykatt/userscripts
              LISTING
              sed -i 's|^              ||' "listings/$name.md"

              _link_node_modules
              "$NODE_MODULES_STORE/.bin/eslint" "$f" --fix >/dev/null 2>&1 || true

              echo "created $f and listings/$name.md"
              echo
              echo "next:"
              echo "  1. MEASURE the live page with every userscript disabled, then write"
              echo "     the selectors and the dated evidence into the header comment."
              echo "  2. add a README.md catalogue row:"
              echo "     | \`$f\` — **TODO name** | TODO target | TODO host badge |"
              echo "  3. add a CHANGELOG.md entry under '## [Unreleased]'"
              echo "  4. nix run .#lint"
            '';
          };

          # ── Diagrams for listings/*.md ─────────────────────────────────
          diagram = mk {
            name = "diagram";
            deps = [ mermaid-ascii ];
            text = ''
              # Reads a Mermaid graph from a file or stdin and prints the ASCII
              # rendering, with the flags this repository standardised on:
              #   -p 0  no border padding   -x 1  minimal horizontal gap
              #   -y 2  the MINIMUM that still leaves an arrow stem (-y 1
              #         collapses the stem and head to a bare triangle)
              # Never -a/--ascii: that downgrades the box-drawing glyphs.
              if [ $# -ge 1 ] && [ -f "$1" ]; then
                src=$(cat "$1")
              else
                src=$(cat)
              fi

              out=$(printf '%s\n' "$src" | mermaid-ascii -p 0 -x 1 -y 2)
              printf '%s\n' "$out"

              # wc -L, never awk length(): awk counts BYTES, so every box glyph
              # counts 3 and a 17-column diagram reports 51.
              width=$(printf '%s\n' "$out" | wc -L | tr -d ' ')
              if [ "$width" -gt 80 ]; then
                echo >&2
                echo "diagram is $width columns; the budget is 80." >&2
                echo "shorten the labels, switch to graph TD, or split it in two." >&2
                exit 1
              fi
            '';
          };

          # ── Housekeeping ───────────────────────────────────────────────
          deps = mk {
            name = "deps";
            text = ''
              # Name guard: this deletes a directory, so refuse to run anywhere
              # that is not this repository's root.
              grep -q '"@izzykatt/userscripts"' package.json 2>/dev/null || {
                echo "refusing: $PRJ does not look like izzykatt/userscripts" >&2
                exit 1
              }
              if [ -e node_modules ] && [ ! -L node_modules ]; then
                echo "removing the npm-installed node_modules/ (gitignored build output)"
                rm -rf node_modules
              fi
              ln -sfn "$NODE_MODULES_STORE" node_modules
              echo "node_modules -> $NODE_MODULES_STORE"
            '';
          };

          link-check = mk {
            name = "link-check";
            deps = [ pkgs.lychee ];
            text = ''
              # NETWORK. Deliberately an app and never a `nix flake check`
              # gate: a check that fails because a third-party host rate-limits
              # a crawler teaches nothing about this repository.
              # 403/429 are accepted because Greasy Fork and Sleazy Fork both
              # answer a bare crawler that way while serving a browser fine.
              exec lychee --no-progress --max-retries 2 \
                --accept '200,206,403,429' \
                --exclude-path node_modules --exclude-path .direnv \
                -- './**/*.md'
            '';
          };

          env-doctor = mk {
            name = "env-doctor";
            text = ''
              # Reports PRESENCE ONLY. Never prints a value.
              miss=0
              printf '%-22s %-9s %-7s %s\n' VARIABLE NEED KIND STATUS
              while IFS=$'\t' read -r n need kind _note; do
                [ -z "$n" ] && continue
                if [ -n "''${!n:-}" ]; then
                  st="set"
                else
                  st="MISSING"
                  [ "$need" = required ] && miss=$((miss + 1))
                fi
                printf '%-22s %-9s %-7s %s\n' "$n" "$need" "$kind" "$st"
              done < ${envTsvFile}
              echo
              echo "need=ci is expected MISSING locally — those are repository"
              echo "variables/secrets read only by .github/workflows/automerge.yml."
              [ "$miss" -gt 0 ] && { echo "$miss required variable(s) missing."; exit 1; }
              exit 0
            '';
          };

          ci = mk {
            name = "ci";
            text = ''
              # Everything CI runs, locally, in CI's order.
              ${self.packages.${system}.lint}/bin/lint
              if command -v nix >/dev/null 2>&1; then
                echo "==> nix flake check"
                nix flake check
              else
                echo "note: nix not on PATH — skipped 'nix flake check'." >&2
              fi
            '';
          };

          # ── The browser ────────────────────────────────────────────────
          browser = mk {
            name = "browser";
            deps = [ pkgs.curl ];
            text = browserPrelude + ''
              _parse_browser_args "$@"
              _refuse_if_port_busy
              _prepare_profile
              echo "[browser] $BROWSER_BIN"
              echo "[browser] profile $PROFILE (project-local - your real browsing is untouched)"
              echo "[browser] CDP on http://127.0.0.1:$PORT"
              exec "$BROWSER_BIN" "''${CHROME_ARGS[@]}" "''${URLS[@]}"
            '';
          };

          watch = mk {
            name = "watch";
            deps = [
              nodejs
              pkgs.curl
            ];
            text = browserPrelude + ''
              _parse_browser_args "$@"
              _prepare_profile

              if curl -fsS --max-time 1 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
                echo "[watch] attaching to the browser already on $PORT (it stays up when this exits)"
              else
                mkdir -p "$PRJ/.nix-browser"
                "$BROWSER_BIN" "''${CHROME_ARGS[@]}" "''${URLS[@]}" \
                  >"$PRJ/.nix-browser/chrome.log" 2>&1 &
                owned=$!
                # This command OWNS the browser it started, so Ctrl-C takes it
                # down too. A browser we merely attached to is left alone.
                # shellcheck disable=SC2064
                trap "kill $owned 2>/dev/null || true" EXIT
                for _ in $(seq 1 60); do
                  curl -fsS --max-time 1 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1 && break
                  sleep 0.25
                done
              fi

              if ! curl -fsS --max-time 1 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
                echo "[watch] the browser never opened its CDP port; see $PRJ/.nix-browser/chrome.log" >&2
                exit 1
              fi

              node scripts/userscript-watch.mjs --port "$PORT" ''${HOT:+--hot}
            '';
          };

          # The supervisor behind the Claude Code hooks, exposed so a person can
          # drive it too. `ensure` is deliberately NOT an app: starting the loop
          # by hand is what `watch` is for, and a command that silently declines
          # would be a confusing thing to type.
          watch-status = mk {
            name = "watch-status";
            deps = [ nodejs ];
            text = "node scripts/watch-daemon.mjs status";
          };

          watch-stop = mk {
            name = "watch-stop";
            deps = [ nodejs ];
            text = "node scripts/watch-daemon.mjs stop";
          };

          browser-bump = mk {
            name = "browser-bump";
            deps = [
              pkgs.curl
              pkgs.jq
            ];
            text = ''
              # NETWORK. Prints what nix/chrome-for-testing.nix should say next.
              api=https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json
              if [ $# -eq 0 ]; then
                echo "last known good Chrome for Testing:"
                curl -fsS "$api" | jq -r '.channels | to_entries[] | "  \(.key)\t\(.value.version)"'
                echo
                echo "then: nix run .#browser-bump -- <version>"
                exit 0
              fi
              v="$1"
              echo "  version = \"$v\";"
              for plat in mac-arm64 mac-x64 linux64; do
                url="https://storage.googleapis.com/chrome-for-testing-public/$v/$plat/chrome-$plat.zip"
                if ! h=$(nix-prefetch-url --type sha256 "$url" 2>/dev/null | tail -1); then
                  echo "  # $plat: FAILED to fetch $url" >&2
                  continue
                fi
                sri=$(nix hash convert --hash-algo sha256 --to sri "$h")
                printf '  # %-9s hash = "%s";\n' "$plat" "$sri"
              done
              echo
              echo "paste into nix/chrome-for-testing.nix, then: nix run .#browser"
            '';
          };

          toolkit = mk {
            name = "toolkit";
            text = ''
              cat <<'HELP'
              nix run .#<command>

                lint                    eslint + meta-lint — the two publish gates
                fix                     eslint --fix and markdownlint --fix
                ci                      everything CI runs, in CI's order

                bump <script> [level]   raise @version safely (patch|minor|major|x.y.z)
                check-versions          @version monotonicity against origin/main
                publish-check <script>  every pre-publish condition, as a checklist
                new-script <name>       scaffold a script + listing with the design rules

                browser [--violentmonkey]  pinned Chromium, project-local profile
                watch [--hot] [--violentmonkey]  ^ plus live injection on save
                browser-bump [version]  refresh the pinned Chrome for Testing
                watch-status            is the supervised watch loop up?
                watch-stop              stop the loop the Claude hooks keep alive

                diagram [file]          mermaid -> ASCII for listings/*.md (<=80 cols)
                link-check              lychee over every *.md (NETWORK)
                deps                    point ./node_modules at the flake-pinned tree
                env-doctor              which catalogued variables are set (names only)

              nix flake check           every offline gate, sandboxed
              nix develop               a shell with all of the above on PATH
              HELP
            '';
          };
        }
      );

      apps = forAll (
        system: _:
        lib.mapAttrs (name: drv: {
          type = "app";
          program = "${drv}/bin/${name}";
        }) (lib.filterAttrs (n: _: !(lib.elem n nonApps)) self.packages.${system})
      );

      # ── Gates ────────────────────────────────────────────────────────────
      # Everything here runs OFFLINE, in the sandbox. `lint` is the app, not a
      # check, only because ESLint needs node_modules — and `importNpmLock`
      # gives us that purely, so ESLint IS a check too.
      checks = forAll (
        system: pkgs:
        let
          nodejs = pkgs.nodejs_22;
          nodeModules = pkgs.importNpmLock.buildNodeModules {
            inherit nodejs;
            npmRoot = npmSrc;
          };
          run =
            name: deps: src: script:
            pkgs.runCommand "check-${name}" { nativeBuildInputs = deps; } ''
              cp -R ${src} ./src
              chmod -R u+w ./src
              cd ./src
              ${script}
              touch "$out"
            '';
        in
        removeAttrs self.packages.${system} [ "chromium" ]
        // {
          # eslint-plugin-userscripts resolves from eslint.config.mjs's own
          # directory, so node_modules has to sit beside it — NODE_PATH is
          # CommonJS-only and ESM ignores it.
          eslint = run "eslint" [ nodejs ] eslintSrc ''
            ln -s ${nodeModules}/node_modules node_modules
            ${nodeModules}/node_modules/.bin/eslint .
          '';

          meta-lint = run "meta-lint" [ nodejs ] metaSrc ''
            node scripts/meta-lint.mjs
          '';

          # Independent of ESLint on purpose: a userscript is copied verbatim
          # into the browser, so a syntax error is a script that silently never
          # runs — and ESLint could in principle be configured to skip a file.
          parse = run "parse" [ nodejs ] parseSrc ''
            shopt -s nullglob
            for f in ./*.user.js; do
              echo "parsing $f"
              node --check "$f"
            done
          '';

          # actionlint shells `run:` blocks out to shellcheck when it is on
          # PATH. automerge.yml is ~40 lines of POSIX shell that nothing else
          # checks.
          # Files are named explicitly: with no .git directory in the sandbox,
          # actionlint's project detection fails rather than falling back.
          actionlint = run "actionlint" [ pkgs.actionlint pkgs.shellcheck ] workflowSrc ''
            # The two -ignore patterns are actionlint's BUNDLED metadata being
            # stale, not a defect here: actions/create-github-app-token gained
            # client-id/private-key auth (app-id is then not required), and
            # actionlint 1.7.12 still ships the older input list. The proof it
            # works is in the repository's own history — izzykatt-ci has been
            # opening and squash-merging pull requests with exactly this block.
            # Drop both lines when a newer actionlint stops reporting them.
            actionlint -color \
              -ignore 'missing input "app-id" which is required by action "actions/create-github-app-token' \
              -ignore 'input "client-id" is not defined in action "actions/create-github-app-token' \
              .github/workflows/*.yml
          '';

          markdown = run "markdown" [ pkgs.markdownlint-cli2 ] markdownSrc ''
            markdownlint-cli2
          '';

          typos = run "typos" [ pkgs.typos ] (fs.toSource {
            root = ./.;
            fileset = fs.unions [
              userscriptFiles
              markdownFiles
              nixFiles
              ./scripts
              ./_typos.toml
            ];
          }) "typos";

          # Files named explicitly: `nixfmt <dir>` is deprecated upstream.
          formatting = run "formatting" [ pkgs.nixfmt ] nixSrc ''
            nixfmt --check flake.nix nix/*.nix
          '';
        }
      );

      devShells = forAll (
        system: pkgs:
        let
          nodejs = pkgs.nodejs_22;
        in
        {
          default = pkgs.mkShell {
            packages = [
              nodejs
              self.packages.${system}.mermaid-ascii
              pkgs.actionlint
              pkgs.shellcheck
              pkgs.typos
              pkgs.markdownlint-cli2
              pkgs.lychee
              pkgs.nixfmt
              pkgs.gh
              pkgs.git
              pkgs.jq
            ]
            ++ lib.attrValues (lib.filterAttrs (n: _: !(lib.elem n nonApps)) self.packages.${system});

            shellHook = ''
              echo "userscripts — node $(node --version), $(mermaid-ascii --version 2>/dev/null || echo 'mermaid-ascii')"
              echo "commands: toolkit · lint · fix · bump · publish-check · new-script · diagram"
              echo "run 'toolkit' for the full list."
            '';
          };
        }
      );
    };
}
