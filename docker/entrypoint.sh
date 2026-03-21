#!/bin/bash
set -e

STATUS_FILE="/tmp/review-status"

echo "cloning" > "$STATUS_FILE"

# Configure git credentials
git config --global user.name "$GIT_USER_NAME"
git config --global user.email "$GIT_USER_EMAIL"
git config --global credential.helper '!f() { echo "username=oauth2"; echo "password=$GITLAB_PAT"; }; f'

# Shallow clone single branch
REPO_URL="${GITLAB_URL}/${PROJECT_PATH}.git"
if ! git clone --depth 1 --single-branch -b "$BRANCH" "$REPO_URL" /workspace 2>&1; then
  echo "error: clone failed" > "$STATUS_FILE"
  echo "Clone failed, starting ttyd for debugging"
  ttyd -W -p 7681 -w /workspace /bin/bash &
  exec sleep infinity
fi

cd /workspace

echo "ready" > "$STATUS_FILE"
echo "Environment ready, starting ttyd"

ttyd -W -p 7681 -w /workspace /bin/bash &

exec sleep infinity
