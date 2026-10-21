#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
APP_BUNDLE="$PROJECT_ROOT/out/Resume.app"
CONTENTS="$APP_BUNDLE/Contents"
RESOURCES="$CONTENTS/Resources"
RUNTIME="$RESOURCES/Runtime"

missing=()
blocked=()
sources=()

rm -rf "$APP_BUNDLE"
mkdir -p "$CONTENTS/MacOS" "$RUNTIME"
cp "$SCRIPT_DIR/Info.plist" "$CONTENTS/Info.plist"
printf 'APPL????' > "$CONTENTS/PkgInfo"

swiftc \
  -parse-as-library \
  -swift-version 5 \
  -O \
  -framework AppKit \
  -framework CoreGraphics \
  -framework Foundation \
  "$SCRIPT_DIR/ResumeLauncher.swift" \
  -o "$CONTENTS/MacOS/ResumeLauncher"
chmod 755 "$CONTENTS/MacOS/ResumeLauncher"

if [[ -f "$PROJECT_ROOT/server/index.mjs" ]]; then
  sources+=("$PROJECT_ROOT/server")
else
  missing+=("server/index.mjs")
fi
if [[ -d "$PROJECT_ROOT/src/domain" ]]; then
  sources+=("$PROJECT_ROOT/src/domain")
else
  missing+=("src/domain/")
fi
if [[ -f "$PROJECT_ROOT/dist/index.html" ]]; then
  sources+=("$PROJECT_ROOT/dist")
else
  missing+=("dist/index.html")
fi

for source in "${sources[@]}"; do
  if find "$source" -type d -name .private -print -quit | grep -q .; then
    blocked+=("$source contains a .private directory")
  fi
  if find "$source" -type l -print -quit | grep -q .; then
    blocked+=("$source contains a symbolic link; refusing to package an external target")
  fi
done

if [[ ${#blocked[@]} -eq 0 ]]; then
  if [[ -f "$PROJECT_ROOT/server/index.mjs" ]]; then
    cp -R "$PROJECT_ROOT/server" "$RESOURCES/server"
    find "$RESOURCES/server" -type f -name '*.test.mjs' -delete
  fi
  if [[ -d "$PROJECT_ROOT/src/domain" ]]; then
    mkdir -p "$RESOURCES/src"
    cp -R "$PROJECT_ROOT/src/domain" "$RESOURCES/src/domain"
    find "$RESOURCES/src/domain" -type f -name '*.test.mjs' -delete
  fi
  if [[ -f "$PROJECT_ROOT/dist/index.html" ]]; then
    cp -R "$PROJECT_ROOT/dist" "$RESOURCES/dist"
  fi
fi

node_source="$(command -v node || true)"
if [[ -n "$node_source" && -x "$node_source" ]]; then
  cp -L "$node_source" "$RUNTIME/node"
  chmod 755 "$RUNTIME/node"
  if command -v otool >/dev/null 2>&1; then
    otool -L "$RUNTIME/node" > "$RUNTIME/node-dependencies.txt"
    libnode_name="$(sed -nE 's/^[[:space:]]*@rpath\/(libnode[^[:space:]]+\.dylib).*/\1/p' "$RUNTIME/node-dependencies.txt" | head -n 1)"
    if [[ -n "$libnode_name" ]]; then
      node_real="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$node_source")"
      node_library="$(dirname "$node_real")/../lib/$libnode_name"
      if [[ -f "$node_library" ]]; then
        mkdir -p "$RESOURCES/lib"
        cp -L "$node_library" "$RESOURCES/lib/$libnode_name"
      else
        printf '%s\n' "Bundled Node is missing its libnode dependency; launcher will fall back to an installed Node.js." > "$RUNTIME/node-note.txt"
      fi
    fi
  fi
  if ! "$RUNTIME/node" --version >/dev/null 2>&1; then
    printf '%s\n' "Bundled Node still needs dynamic libraries from the current host; launcher will fall back to an installed Node.js." > "$RUNTIME/node-note.txt"
  fi
else
  missing+=("a runnable Node.js executable")
fi

if [[ ${#blocked[@]} -gt 0 ]]; then
  missing+=("safe source copy (${blocked[*]})")
fi

if [[ ${#missing[@]} -eq 0 ]]; then
  {
    printf '%s\n' "STATUS=COMPLETE"
    printf '%s\n' "This development app contains server/, src/domain/, and dist/ copied from the project checkout."
  } > "$RESOURCES/BUILD_STATUS.txt"
else
  {
    printf '%s\n' "STATUS=INCOMPLETE"
    printf 'Missing: %s\n' "${missing[*]}"
    printf '%s\n' "The launcher checks for server/index.mjs and dist/index.html before starting."
  } > "$RESOURCES/BUILD_STATUS.txt"
fi

codesign --force --deep --sign - --timestamp=none "$APP_BUNDLE"
codesign --verify --deep --strict "$APP_BUNDLE"
plutil -lint "$CONTENTS/Info.plist"

if [[ ${#missing[@]} -gt 0 ]]; then
  printf 'INCOMPLETE: created %s, but could not package: %s\n' "$APP_BUNDLE" "${missing[*]}" >&2
  exit 2
fi

printf 'BUILT: %s\n' "$APP_BUNDLE"
