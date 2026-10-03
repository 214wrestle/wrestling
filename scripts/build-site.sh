#!/usr/bin/env bash
# Builds the GitHub Pages site into _site/:
#   index.html                          landing page (from site/)
#   varsity/                            VARSITY production build
#   mat-rivals/                         Mat Rivals production build (game + mockups.html)
#   mat-rivals/docs/style-mockups/      character style comparison page
# Both games build with relative asset paths, so the site works under any subpath.
# Set SKIP_INSTALL=1 to reuse existing node_modules instead of running npm ci.
set -euo pipefail
cd "$(dirname "$0")/.."

install() { if [ -z "${SKIP_INSTALL:-}" ]; then npm ci --no-audit --no-fund; fi; }

(cd wrestling_codex && install && npm run build)
(cd wrestling_claude && install && npm run build -- --base=./)

rm -rf _site
mkdir -p _site/mat-rivals/docs
cp -r site/. _site/
cp -r wrestling_codex/dist _site/varsity
cp -r wrestling_claude/dist/. _site/mat-rivals/
cp -r wrestling_claude/docs/style-mockups _site/mat-rivals/docs/
touch _site/.nojekyll
echo "Site built in _site/"
