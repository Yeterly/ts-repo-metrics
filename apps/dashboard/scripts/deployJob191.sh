#!/usr/bin/env bash
# Builds the current commit in Azure Container Registry and deploys it to the Job191 web app and grading worker.
# Usage (from anywhere in the repo, Git Bash or Linux/macOS): bash apps/dashboard/scripts/deployJob191.sh
# Needs: az signed in to the Yeterly subscription, and apps/dashboard/.env.local with the NEXT_PUBLIC_* values.
# Only public build values are read from .env.local; runtime secrets stay in the Container Apps.
set -euo pipefail
export MSYS_NO_PATHCONV=1

RG=job191-rg
ACR=job191acr
REPO=job191-web
APPS=(job191-web job191-worker)
HEALTH_URL=https://job191.yeterly.ai/api/health

root=$(git rev-parse --show-toplevel)
cd "$root"
if [ -n "$(git status --porcelain)" ]; then
  echo "The working tree has uncommitted changes. Commit or stash them so the image matches its tag." >&2
  exit 1
fi
tag=$(git rev-parse --short HEAD)

env_file=apps/dashboard/.env.local
get() { grep -E "^\s*$1=" "$env_file" | tail -1 | cut -d= -f2- | tr -d '"\r' | sed 's/^ *//;s/ *$//'; }
args=(--build-arg CSE115A_SITE=true)
for name in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_CSE115A_ALLOWED_EMAIL_DOMAINS; do
  args+=(--build-arg "$name=$(get "$name")")
done

# ACR Tasks cannot parse `FROM --platform=...`; build from a copy without it (the build is still linux/amd64).
# ACR also splits build arguments that contain spaces, so course names come from the defaults in code.
build_file=$(mktemp "$root/Dockerfile.acr.XXXXXX")
trap 'rm -f "$build_file"' EXIT
sed 's/^FROM --platform=linux\/amd64 /FROM /' Dockerfile > "$build_file"

echo "Building $REPO:$tag in $ACR..."
PYTHONIOENCODING=utf-8 az acr build -r "$ACR" -f "$(basename "$build_file")" -t "$REPO:$tag" -t "$REPO:latest" \
  "${args[@]}" --platform linux/amd64 --no-logs . -o none
status=$(az acr task list-runs -r "$ACR" --top 1 --query "[0].status" -o tsv)
[ "$status" = "Succeeded" ] || { echo "Build $status. See: az acr task logs -r $ACR" >&2; exit 1; }

for app in "${APPS[@]}"; do
  echo "Deploying $tag to $app..."
  az containerapp update -n "$app" -g "$RG" --image "$ACR.azurecr.io/$REPO:$tag" --only-show-errors -o none
done

for _ in $(seq 1 18); do
  code=$(curl -s -m 15 -o /dev/null -w "%{http_code}" "$HEALTH_URL" || true)
  [ "$code" = 200 ] && { echo "Deployed $tag. $HEALTH_URL is healthy."; exit 0; }
  sleep 10
done
echo "Deployed $tag, but $HEALTH_URL did not return 200 within 3 minutes." >&2
exit 1
