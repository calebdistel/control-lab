/**
 * Transpiles a limited Java subset to JavaScript for in-browser execution.
 * Covers: static methods, primitives, Strings, arrays, if/else, for loops,
 * switch, System.out.println/print, Math.*, String.equals(), type casts.
 *
 * Not supported: generics, exceptions, Scanner, inner classes, inheritance.
 */

export function transpile(java) {
  let code = java;

  code = stripComments(code);

  const body = extractClassBody(code);
  if (body != null) code = body;

  code = convertMethods(code);

  // Enhanced for: for (Type var : iterable)
  code = code.replace(/\bfor\s*\(\s*(?:[\w\[\]]+)\s+(\w+)\s*:/g, 'for (let $1 of');

  // For-loop init type
  code = code.replace(/\bfor\s*\(\s*(?:int|long|double|float|byte|short)\s+/g, 'for (let ');

  // Variable/field declarations with initializer (strips type + optional static/final)
  code = code.replace(
    /\b(?:(?:static|final)\s+)*(?:int|long|double|float|boolean|String|char|byte|short)\s*(?:\[\]\s*)?\b(\w+)\s*(?==)/g,
    'let $1'
  );

  // Standalone declarations: int x;
  code = code.replace(
    /\b(?:int|long|double|float|boolean|String|char|byte|short)\s+(\w+)\s*;/g,
    'let $1;'
  );

  // Array initializer braces: = { a, b, c } → = [ a, b, c ]  (no nested braces)
  code = code.replace(/=\s*\{([^{}]*)\}/g, '= [$1]');

  // new PrimitiveType[n]
  code = code.replace(/\bnew\s+(?:int|long|byte|short|double|float)\s*\[([^\]]*)\]/g, 'new Array($1).fill(0)');
  code = code.replace(/\bnew\s+boolean\s*\[([^\]]*)\]/g, 'new Array($1).fill(false)');
  code = code.replace(/\bnew\s+String\s*\[([^\]]*)\]/g, 'new Array($1).fill("")');

  // System.out.println / System.out.print
  code = code.replace(/\bSystem\.out\.println\s*\(\s*\)/g, '__println("")');
  code = code.replace(/\bSystem\.out\.println\s*\(/g, '__println(');
  code = code.replace(/\bSystem\.out\.print\s*\(\s*\)/g, '__print("")');
  code = code.replace(/\bSystem\.out\.print\s*\(/g, '__print(');

  // String.equals(): repeated to handle chained calls on same line
  for (let i = 0; i < 6; i++) {
    code = code.replace(/(\w+)\.equals\s*\(([^()]+)\)/g, '($1 === $2)');
  }

  // Type casts — (double)/(float) are no-ops in JS; (int) truncates
  code = code.replace(/\(\s*double\s*\)\s*/g, '');
  code = code.replace(/\(\s*float\s*\)\s*/g, '');
  code = code.replace(/\(\s*long\s*\)\s*/g, '');
  code = code.replace(/\(\s*int\s*\)\s*\(([^()]+)\)/g, '(($1)|0)');
  code = code.replace(/\(\s*int\s*\)\s*([\w.[\]]+)/g, '($1|0)');

  // .length() → .length  (Java String method vs JS property)
  code = code.replace(/\.length\s*\(\s*\)/g, '.length');

  // Standard library
  code = code.replace(/\bInteger\.parseInt\s*\(/g, 'parseInt(');
  code = code.replace(/\bInteger\.toString\s*\(/g, 'String(');
  code = code.replace(/\bDouble\.parseDouble\s*\(/g, 'parseFloat(');
  code = code.replace(/\bString\.valueOf\s*\(/g, 'String(');
  // Math.* identical in JS — no conversion needed

  // Call main() at the end
  code += '\nmain();\n';

  return code;
}

function stripComments(code) {
  return code
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractClassBody(code) {
  const m = code.match(/\bclass\s+\w+(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/);
  if (!m) return null;
  const start = m.index + m[0].length;
  let depth = 1, i = start;
  while (i < code.length && depth > 0) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') depth--;
    i++;
  }
  return code.slice(start, i - 1);
}

const CONTROL_KEYWORDS = new Set([
  'if', 'else', 'while', 'for', 'switch', 'do',
  'try', 'catch', 'finally', 'synchronized', 'new', 'return', 'throw',
]);

function convertMethods(code) {
  return code.replace(
    /\b((?:(?:public|private|protected|static|final|abstract|synchronized)\s+)*)(?:[\w\[\]<>]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w\s,]+)?\s*\{/g,
    (match, _modifiers, name, params) => {
      if (CONTROL_KEYWORDS.has(name)) return match;
      const jsParams = params.split(',')
        .map(p => {
          const parts = p.trim().split(/\s+/);
          return parts[parts.length - 1] || '';
        })
        .filter(Boolean)
        .join(', ');
      return `function ${name}(${jsParams}) {`;
    }
  );
}
