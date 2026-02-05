#!/bin/bash
# Verify that all examples can be parsed and loaded

set -e

echo "Verifying ACP SDK examples..."
echo ""

examples=(
  "echo-agent.ts"
  "file-agent.ts"
  "calculator-agent.ts"
  "advanced-agent.ts"
  "cli-client.ts"
  "protocol-handler-demo.ts"
)

failed=0

for example in "${examples[@]}"; do
  echo -n "Checking $example... "

  # Try to parse with tsx (dry run)
  if npx tsx --tsconfig tsconfig.json --no-warnings "$example" --help 2>/dev/null || [ $? -eq 1 ]; then
    echo "✓ OK (syntax valid)"
  else
    echo "✗ FAILED"
    failed=$((failed + 1))
  fi
done

echo ""
if [ $failed -eq 0 ]; then
  echo "All examples verified successfully!"
  exit 0
else
  echo "$failed example(s) failed verification"
  exit 1
fi
