# mermaid-ascii — render Mermaid graphs as ASCII in the terminal.
#
# VENDORED HERE ON PURPOSE. It is not in nixpkgs (checked 2026-09-28), and
# listings/*.md ship rendered ASCII diagrams produced by it, so the renderer is
# a real build input of this repository's deliverables — not a personal
# convenience. Carrying the derivation here keeps `nix develop` self-sufficient:
# a clone needs this flake and nothing else.
#
# To bump: change `version`, then refresh both hashes.
#   src.hash:
#     nix-prefetch-url --unpack https://github.com/AlexanderGrooff/mermaid-ascii/archive/refs/tags/<v>.tar.gz
#     nix hash convert --hash-algo sha256 --to sri <base32>
#   vendorHash: set it to lib.fakeHash, build once, copy the hash Nix reports.
{
  lib,
  buildGoModule,
  fetchFromGitHub,
}:
buildGoModule rec {
  pname = "mermaid-ascii";
  version = "1.6.1";

  src = fetchFromGitHub {
    owner = "AlexanderGrooff";
    repo = "mermaid-ascii";
    rev = version; # upstream tags are bare "1.6.1", with no leading v
    hash = "sha256-KYCJIgLwjJR5RM1AdGrV47UhFgpLqwro42E54pzhYWE=";
  };

  vendorHash = "sha256-S/K6W8KC6YzwZPioucoiwOMd29LPv0J22T3MS0X+W5g=";

  meta = {
    description = "Render Mermaid graphs as ASCII in your terminal";
    homepage = "https://github.com/AlexanderGrooff/mermaid-ascii";
    license = lib.licenses.mit;
    mainProgram = "mermaid-ascii";
    platforms = lib.platforms.unix;
  };
}
