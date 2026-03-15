#!/usr/bin/env python3
"""
SQL Evaluator
Reads base64-encoded SQL query and schema from environment, executes against SQLite
"""

import base64
import os
import sys
import sqlite3
import json
import io

CODE = os.environ.get('CODE')  # The SQL query
INPUT = os.environ.get('INPUT')  # Expected output or additional params
OUTPUT_LIMIT = int(os.environ.get('OUTPUT_LIMIT', '10240'))

if not CODE:
    print("No SQL query provided", file=sys.stderr)
    sys.exit(1)

try:
    sql_query = base64.b64decode(CODE).decode('utf-8')
    
    # Parse input as JSON if provided (contains schema and seed data)
    schema_info = {}
    if INPUT:
        try:
            schema_info = json.loads(base64.b64decode(INPUT).decode('utf-8'))
        except:
            pass
    
    # Create in-memory SQLite database
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Execute schema setup if provided
    if 'schema' in schema_info:
        cursor.executescript(schema_info['schema'])
    
    # Insert seed data if provided
    if 'seedData' in schema_info:
        for table, rows in schema_info['seedData'].items():
            if not rows:
                continue
            columns = list(rows[0].keys())
            placeholders = ', '.join(['?' for _ in columns])
            insert_sql = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
            for row in rows:
                cursor.execute(insert_sql, [row.get(c) for c in columns])
    
    conn.commit()
    
    # Execute the user's query
    output_buffer = io.StringIO()
    
    try:
        cursor.execute(sql_query)
        
        # Fetch results
        results = cursor.fetchall()
        
        # Format output
        if cursor.description:
            # SELECT query - return column names and rows
            columns = [desc[0] for desc in cursor.description]
            rows = []
            for row in results:
                row_dict = {}
                for i, col in enumerate(columns):
                    row_dict[col] = row[i]
                rows.append(row_dict)
            
            output = {
                'columns': columns,
                'rows': rows,
                'rowCount': len(rows)
            }
        else:
            # Non-SELECT query
            output = {
                'rowCount': cursor.rowcount,
                'lastRowId': cursor.lastrowid
            }
        
        output_buffer.write(json.dumps(output, default=str))
        
    except sqlite3.Error as e:
        output_buffer.write(f"SQL Error: {e}")
        
    conn.close()
    
    result_str = output_buffer.getvalue()
    
    # Truncate if needed
    if len(result_str) > OUTPUT_LIMIT:
        result_str = result_str[:OUTPUT_LIMIT] + '\n[Output truncated]'
    
    print('\n__RESULT__')
    print(result_str)
    
    sys.exit(0)
    
except Exception as e:
    print('\n__ERROR__')
    print(str(e))
    sys.exit(1)
