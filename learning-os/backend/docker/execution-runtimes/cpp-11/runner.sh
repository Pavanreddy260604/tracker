#!/bin/sh
# C++ Code Execution Runner

CODE="${CODE:-}"
INPUT="${INPUT:-}"
OUTPUT_LIMIT="${OUTPUT_LIMIT:-10240}"
TIMEOUT_MS="${TIMEOUT_MS:-5000}"

if [ -z "$CODE" ]; then
    echo "No code provided" >&2
    exit 1
fi

# Decode base64 code
echo "$CODE" | base64 -d > /tmp/solution.cpp

# Decode input if provided
if [ -n "$INPUT" ]; then
    echo "$INPUT" | base64 -d > /tmp/input.txt
fi

TIMEOUT_SEC=$((TIMEOUT_MS / 1000))

# Compile
cd /tmp
g++ -std=c++11 -O2 -o solution solution.cpp 2>&1
if [ $? -ne 0 ]; then
    echo "__ERROR__"
    echo "Compilation failed"
    exit 1
fi

# Run with timeout
if [ -f /tmp/input.txt ]; then
    timeout "$TIMEOUT_SEC" ./solution < /tmp/input.txt > /tmp/output.txt 2> /tmp/error.txt
else
    timeout "$TIMEOUT_SEC" ./solution > /tmp/output.txt 2> /tmp/error.txt
fi

EXIT_CODE=$?

# Truncate output
head -c "$OUTPUT_LIMIT" /tmp/output.txt > /tmp/output_truncated.txt
if [ $(wc -c < /tmp/output.txt) -gt "$OUTPUT_LIMIT" ]; then
    echo "\n[Output truncated]" >> /tmp/output_truncated.txt
fi

head -c "$OUTPUT_LIMIT" /tmp/error.txt > /tmp/error_truncated.txt
if [ $(wc -c < /tmp/error.txt) -gt "$OUTPUT_LIMIT" ]; then
    echo "\n[Output truncated]" >> /tmp/error_truncated.txt
fi

if [ $EXIT_CODE -eq 124 ]; then
    echo "[ERROR: Execution timeout]" >&2
    exit 1
fi

echo "__RESULT__"
echo "{"
echo "  \"stdout\": $(cat /tmp/output_truncated.txt | python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""'),"
echo "  \"stderr\": $(cat /tmp/error_truncated.txt | python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""'),"
echo "  \"status\": $(if [ $EXIT_CODE -eq 0 ]; then echo '"success"'; else echo '"error"'; fi)"
echo "}"

exit $EXIT_CODE
