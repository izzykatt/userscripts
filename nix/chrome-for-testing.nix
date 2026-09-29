# Chrome for Testing — a pinned, non-self-updating Chromium build.
#
# WHY NOT `pkgs.chromium`: it is LINUX-ONLY in nixpkgs (meta.platforms carries
# no darwin entry, checked 2026-09-29), and this repository is maintained on
# aarch64-darwin. WHY NOT the browser already in /Applications: it auto-updates,
# so "the version I measured against" is not a thing you can write down.
#
# Chrome for Testing is Google's build FOR automation: every version stays
# hosted at its own immutable URL forever, it never self-updates, and it keeps
# --load-extension working. nixpkgs' own `chromedriver` already sources from
# this bucket on darwin and marks it free, which is the precedent followed here.
#
# It is Chrome-branded rather than Chromium-branded. The engine is the same one;
# what differs is the branding and the absence of an updater. Say "Chrome for
# Testing <version>" in a measurement note, not "Chromium".
#
# To bump: `nix run .#browser-bump` prints the current channel versions and the
# three hashes, ready to paste. By hand:
#   curl -s https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json
#   nix-prefetch-url --type sha256 https://storage.googleapis.com/chrome-for-testing-public/<v>/<plat>/chrome-<plat>.zip
#   nix hash convert --hash-algo sha256 --to sri <base32>
{
  lib,
  stdenv,
  fetchurl,
  unzip,
}:
let
  version = "154.0.8037.57"; # Stable channel, last known good 2026-09-29

  # Google ships mac-arm64, mac-x64 and linux64 — and NOT aarch64-linux. The
  # flake falls back to pkgs.chromium there, which nixpkgs does build.
  platforms = {
    aarch64-darwin = {
      slug = "mac-arm64";
      hash = "sha256-Dms0OUacG4uVsuiccuop968A+ywoqIeDWKC2ACttOmQ=";
    };
    x86_64-darwin = {
      slug = "mac-x64";
      hash = "sha256-9sDf9GYvH/sB9j+d44iOqV5MY0hwqLn1Xm0iCLopqKk=";
    };
    x86_64-linux = {
      slug = "linux64";
      hash = "sha256-zu4pcgdNRB6nxLqLzA6qt35+h2gPZlPXPTBlhR/hAwI=";
    };
  };

  plat =
    platforms.${stdenv.hostPlatform.system}
      or (throw "chrome-for-testing: Google publishes no build for ${stdenv.hostPlatform.system}");
in
stdenv.mkDerivation {
  pname = "chrome-for-testing";
  inherit version;

  src = fetchurl {
    url = "https://storage.googleapis.com/chrome-for-testing-public/${version}/${plat.slug}/chrome-${plat.slug}.zip";
    inherit (plat) hash;
  };

  nativeBuildInputs = [ unzip ];
  sourceRoot = "chrome-${plat.slug}";
  dontConfigure = true;
  dontBuild = true;
  dontFixup = true; # the bundle is signed; rewriting it invalidates that

  installPhase =
    if stdenv.hostPlatform.isDarwin then
      ''
        runHook preInstall
        mkdir -p "$out/Applications" "$out/bin"
        # cp -R, never -L: the .app's Frameworks are SYMLINKS into
        # Versions/Current, and resolving them both doubles the size and
        # breaks the signature.
        cp -R "Google Chrome for Testing.app" "$out/Applications/"
        app="$out/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
        chmod +x "$app"

        # An `exec` WRAPPER, never a symlink. Chrome resolves its Framework
        # through @executable_path, which macOS takes from the path the process
        # was launched as — a symlink at $out/bin/chrome makes that $out/bin,
        # and the framework lookup then fails with a three-line dlopen error
        # naming a path that does not exist (measured 2026-09-29). `exec`
        # replaces the process, so @executable_path becomes the .app's own
        # MacOS directory, which is the only place the Framework is.
        cat > "$out/bin/chrome" <<EOF
        #!/bin/sh
        exec "$app" "\$@"
        EOF
        sed -i 's|^        ||' "$out/bin/chrome"
        chmod +x "$out/bin/chrome"
        runHook postInstall
      ''
    else
      ''
        runHook preInstall
        mkdir -p "$out/opt/chrome" "$out/bin"
        cp -R . "$out/opt/chrome"
        chmod +x "$out/opt/chrome/chrome"
        ln -s "$out/opt/chrome/chrome" "$out/bin/chrome"
        runHook postInstall
      '';

  meta = {
    description = "Chrome for Testing — a pinned, non-self-updating Chromium build";
    homepage = "https://developer.chrome.com/blog/chrome-for-testing";
    license = lib.licenses.unfree;
    mainProgram = "chrome";
    platforms = lib.attrNames platforms;
    sourceProvenance = [ lib.sourceTypes.binaryNativeCode ];
  };
}
