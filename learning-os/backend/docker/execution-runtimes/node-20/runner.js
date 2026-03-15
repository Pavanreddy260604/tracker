#!/usr/bin/env node
/**
 * Node.js Code Execution Runner
 * Reads base64-encoded code from environment, executes with timeout
 */

const CODE = process.env.CODE;
const INPUT = process.env.INPUT;
const OUTPUT_LIMIT = parseInt(process.env.OUTPUT_LIMIT || '10240');
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '5000');

if (!CODE) {
  console.error('No code provided');
  process.exit(1);
}

let output = '';
let errorOutput = '';

// Override console methods to capture output
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const line = args.join(' ') + '\n';
  if (output.length + line.length <= OUTPUT_LIMIT) {
    output += line;
  }
  originalLog.apply(console, args);
};

console.error = (...args) => {
  const line = args.join(' ') + '\n';
  if (errorOutput.length + line.length <= OUTPUT_LIMIT) {
    errorOutput += line;
  }
  originalError.apply(console, args);
};

// Set up timeout
timeoutId = setTimeout(() => {
  console.error('\n[ERROR: Execution timeout]');
  process.exit(1);
}, TIMEOUT_MS);

// Decode and execute code
try {
  const code = Buffer.from(CODE, 'base64').toString('utf8');
  const input = INPUT ? Buffer.from(INPUT, 'base64').toString('utf64') : '';
  
  // Make input available as a global
  global.input = input;
  global.INPUT = input;
  
  // Create a sandbox context
  const sandbox = {
    console,
    require,
    process: {
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      exit: (code) => {
        clearTimeout(timeoutId);
        process.exit(code || 0);
      }
    },
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Symbol,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    decodeURI,
    encodeURIComponent,
    decodeURIComponent,
    escape,
    unescape,
    eval: undefined, // Disable eval
    Function: undefined // Disable Function constructor
  };
  
  // Execute in sandbox
  const vm = require('vm');
  const script = new vm.Script(code);
  const context = vm.createContext(sandbox);
  
  script.runInContext(context, {
    timeout: TIMEOUT_MS,
    displayErrors: true
  });
  
  clearTimeout(timeoutId);
  
  // Output result marker
  console.log('\n__RESULT__');
  console.log(JSON.stringify({
    stdout: output,
    stderr: errorOutput,
    status: 'success'
  }));
  
  process.exit(0);
} catch (error) {
  clearTimeout(timeoutId);
  console.error('\n__ERROR__');
  console.error(error.message);
  process.exit(1);
}
