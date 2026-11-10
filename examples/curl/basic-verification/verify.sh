#!/usr/bin/env bash
# EpoClaim REST API — Basic Verification Example via cURL
set -e

BASE_URL="${EPOCLAIM_BASE_URL:-http://localhost:8000}"
API_KEY="${EPOCLAIM_API_KEY:-}"

echo "=========================================================="
echo "EpoClaim REST API Verification Example"
echo "Target URL: $BASE_URL"
echo "=========================================================="

# 1. Health Check
echo -e "\n1. Checking Backend Service Health..."
curl -s -X GET "$BASE_URL/api/v1/health" \
  -H "Accept: application/json" | python -m json.tool

# 2. Submit Verification Request
echo -e "\n2. Submitting AI-generated response for verification..."
AUTH_HEADER=()
if [ -n "$API_KEY" ]; then
  AUTH_HEADER=(-H "X-API-Key: $API_KEY")
fi

RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/analyze" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER[@]}" \
  -d '{
    "prompt": "Who is the CEO of OpenAI?",
    "response_text": "OpenAI is based in San Francisco, and its interim CEO is Mira Murati.",
    "context_documents": [
      "OpenAI is an AI research organization headquartered in San Francisco. Mira Murati was named interim CEO on November 17, 2023. On November 29, 2023, Sam Altman officially returned as CEO of OpenAI."
    ],
    "enable_live_search": false
  }')

echo "$RESPONSE" | python -m json.tool > verification_report.json

REPORT_ID=$(echo "$RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin).get('report_id', ''))")

echo "Generated Report ID: $REPORT_ID"
echo "Saved full report to verification_report.json"

# 3. Retrieve Report by ID
if [ -n "$REPORT_ID" ]; then
  echo -e "\n3. Retrieving report by ID ($REPORT_ID)..."
  curl -s -X GET "$BASE_URL/api/v1/analysis/$REPORT_ID" \
    "${AUTH_HEADER[@]}" \
    -H "Accept: application/json" | python -c "import sys, json; r = json.load(sys.stdin); print(f'Assessment: {r.get(\"overall_assessment\")}\nTotal Claims: {r.get(\"total_claims\")} | Outdated: {r.get(\"outdated_claims\")} | Supported: {r.get(\"supported_claims\")}')"
fi

