#!/bin/bash
# Build all execution runtime Docker images

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIMES_DIR="$SCRIPT_DIR/backend/docker/execution-runtimes"

echo "Building interview simulator execution runtime images..."
echo "======================================================="

# Function to build an image
build_image() {
    local name=$1
    local dir=$2
    
    echo ""
    echo "Building $name..."
    echo "-------------------"
    
    cd "$dir"
    docker build -t "interview-runtime:$name" .
    
    if [ $? -eq 0 ]; then
        echo "✅ $name built successfully"
    else
        echo "❌ $name build failed"
        exit 1
    fi
}

# Build all runtimes
build_image "node-20" "$RUNTIMES_DIR/node-20"
build_image "python-3.11" "$RUNTIMES_DIR/python-3.11"
build_image "java-17" "$RUNTIMES_DIR/java-17"
build_image "cpp-11" "$RUNTIMES_DIR/cpp-11"
build_image "go-1.21" "$RUNTIMES_DIR/go-1.21"
build_image "sql-evaluator" "$RUNTIMES_DIR/sql-evaluator"

echo ""
echo "======================================================="
echo "All runtime images built successfully!"
echo ""
echo "Available images:"
docker images | grep "interview-runtime"
