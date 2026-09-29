# Violentmonkey, unpacked for `--load-extension`.
#
# This is the lane that verifies a script the way a READER runs it: a real
# install in a real userscript manager, with the manager's own update path and
# its "track local file" watcher. The CDP lane in `nix run .#watch` is faster
# and fully automatic, but it is an injection — faithful for these scripts only
# because every one of them is `@grant none`.
#
# The mv3 asset is the Chrome one. `Violentmonkey-webext-*.zip` is Firefox's and
# `*-mv2-*.crx` is a manifest V2 build Chrome 139+ no longer runs.
#
# To bump: change `version`, then — note --unpack, which is NOT optional here.
# fetchzip hashes the UNPACKED tree, so a plain `nix-prefetch-url` gives the
# hash of the .zip and the build fails with a mismatch (measured 2026-09-29).
#   nix-prefetch-url --unpack https://github.com/violentmonkey/violentmonkey/releases/download/v<v>/Violentmonkey-mv3-v<v>.zip
#   nix hash convert --hash-algo sha256 --to sri <base32>
{
  lib,
  fetchzip,
}:
let
  version = "2.49.0";
in
fetchzip {
  name = "violentmonkey-${version}";
  url = "https://github.com/violentmonkey/violentmonkey/releases/download/v${version}/Violentmonkey-mv3-v${version}.zip";
  hash = "sha256-jeIaytwDzN0Q+Lg+K19HWKZlTzEzBPiUjJy6M+H1kZc=";
  # The zip is FLAT — manifest.json sits at the root, with no wrapping
  # directory to strip. stripRoot's default of true would fail the unpack.
  stripRoot = false;

  meta = {
    description = "Violentmonkey userscript manager, unpacked for --load-extension";
    homepage = "https://violentmonkey.github.io/";
    license = lib.licenses.mit;
    platforms = lib.platforms.all;
  };
}
