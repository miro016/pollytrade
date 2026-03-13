#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SCHEMAS_DIR="$ROOT_DIR/packages/shared-schemas/schemas"
GENERATED_DIR="$ROOT_DIR/packages/shared-schemas/generated"

echo "=== Generating types from JSON schemas ==="

mkdir -p "$GENERATED_DIR/typescript" "$GENERATED_DIR/python"

# Generate TypeScript interfaces
echo "[+] Generating TypeScript interfaces..."
for schema in "$SCHEMAS_DIR"/*.schema.json; do
    name=$(basename "$schema" .schema.json)
    npx json2ts "$schema" > "$GENERATED_DIR/typescript/${name}.ts"
    echo "    $name.ts"
done

# Generate index barrel file
echo "// Auto-generated — do not edit" > "$GENERATED_DIR/typescript/index.ts"
for ts_file in "$GENERATED_DIR/typescript"/*.ts; do
    name=$(basename "$ts_file" .ts)
    [ "$name" = "index" ] && continue
    echo "export * from './${name}';" >> "$GENERATED_DIR/typescript/index.ts"
done

# Generate Python Pydantic models
echo "[+] Generating Python Pydantic models..."
for schema in "$SCHEMAS_DIR"/*.schema.json; do
    name=$(basename "$schema" .schema.json | tr '-' '_')
    datamodel-codegen \
        --input "$schema" \
        --input-file-type jsonschema \
        --output "$GENERATED_DIR/python/${name}.py" \
        --output-model-type pydantic_v2.BaseModel \
        2>/dev/null || echo "    Warning: failed to generate $name.py"
    echo "    ${name}.py"
done

# Generate __init__.py
echo "# Auto-generated — do not edit" > "$GENERATED_DIR/python/__init__.py"
for py_file in "$GENERATED_DIR/python"/*.py; do
    name=$(basename "$py_file" .py)
    [ "$name" = "__init__" ] && continue
    echo "from .${name} import *" >> "$GENERATED_DIR/python/__init__.py"
done

echo "=== Type generation complete ==="
