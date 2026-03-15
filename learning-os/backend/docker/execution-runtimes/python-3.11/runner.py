#!/usr/bin/env python3
"""
Python Code Execution Runner
Reads base64-encoded code from environment, executes with timeout
"""

import base64
import os
import sys
import signal
import json
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr

CODE = os.environ.get('CODE')
INPUT = os.environ.get('INPUT')
OUTPUT_LIMIT = int(os.environ.get('OUTPUT_LIMIT', '10240'))
TIMEOUT_MS = int(os.environ.get('TIMEOUT_MS', '5000'))

if not CODE:
    print("No code provided", file=sys.stderr)
    sys.exit(1)

class TimeoutError(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutError("Execution timeout")

# Set up timeout
signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(TIMEOUT_MS // 1000)

# Capture output
stdout_capture = StringIO()
stderr_capture = StringIO()

try:
    code = base64.b64decode(CODE).decode('utf-8')
    input_data = base64.b64decode(INPUT).decode('utf-8') if INPUT else ''
    
    # Create restricted globals
    restricted_globals = {
        '__builtins__': {
            'abs': abs,
            'all': all,
            'any': any,
            'bin': bin,
            'bool': bool,
            'bytearray': bytearray,
            'bytes': bytes,
            'chr': chr,
            'complex': complex,
            'dict': dict,
            'divmod': divmod,
            'enumerate': enumerate,
            'filter': filter,
            'float': float,
            'format': format,
            'frozenset': frozenset,
            'hasattr': hasattr,
            'hash': hash,
            'hex': hex,
            'id': id,
            'int': int,
            'isinstance': isinstance,
            'issubclass': issubclass,
            'iter': iter,
            'len': len,
            'list': list,
            'map': map,
            'max': max,
            'min': min,
            'next': next,
            'oct': oct,
            'ord': ord,
            'pow': pow,
            'print': print,
            'range': range,
            'repr': repr,
            'reversed': reversed,
            'round': round,
            'set': set,
            'slice': slice,
            'sorted': sorted,
            'str': str,
            'sum': sum,
            'tuple': tuple,
            'type': type,
            'vars': vars,
            'zip': zip,
            '__import__': __import__,  # Allow imports but will be restricted by container
        },
        'input': lambda: input_data,
        'INPUT': input_data,
    }
    
    with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
        exec(code, restricted_globals)
    
    signal.alarm(0)  # Cancel timeout
    
    stdout = stdout_capture.getvalue()
    stderr = stderr_capture.getvalue()
    
    # Truncate if needed
    if len(stdout) > OUTPUT_LIMIT:
        stdout = stdout[:OUTPUT_LIMIT] + '\n[Output truncated]'
    if len(stderr) > OUTPUT_LIMIT:
        stderr = stderr[:OUTPUT_LIMIT] + '\n[Output truncated]'
    
    print('\n__RESULT__')
    print(json.dumps({
        'stdout': stdout,
        'stderr': stderr,
        'status': 'success'
    }))
    
    sys.exit(0)
    
except TimeoutError:
    print('\n[ERROR: Execution timeout]', file=sys.stderr)
    sys.exit(1)
except Exception as e:
    signal.alarm(0)
    print('\n__ERROR__')
    print(str(e))
    sys.exit(1)
