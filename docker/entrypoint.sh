#!/bin/bash
set -e

STATUS_FILE="/tmp/review-status"

write_status() {
  echo "$1" > "$STATUS_FILE"
}

start_ttyd() {
  ttyd -W -p 7681 -w /workspace ${SHELL:-/bin/bash} &
}

# --- Clone ---
write_status "cloning"

git config --global user.name "$GIT_USER_NAME"
git config --global user.email "$GIT_USER_EMAIL"
git config --global credential.helper '!f() { echo "username=oauth2"; echo "password=$GITLAB_PAT"; }; f'

REPO_URL="${GITLAB_URL}/${PROJECT_PATH}.git"
if ! git clone --single-branch -b "$BRANCH" "$REPO_URL" /workspace 2>&1; then
  write_status "error: clone failed"
  start_ttyd
  exec sleep infinity
fi

cd /workspace

# --- Before Script ---
write_status "initializing"

if [ -n "$BEFORE_SCRIPT" ]; then
  SCRIPT_CONTENT=$(echo "$BEFORE_SCRIPT" | base64 -d)
  if ! bash -c "$SCRIPT_CONTENT"; then
    write_status "error: before-script failed"
    start_ttyd
    exec sleep infinity
  fi
fi

# --- Ready ---
write_status "ready"

start_ttyd
exec sleep infinity
