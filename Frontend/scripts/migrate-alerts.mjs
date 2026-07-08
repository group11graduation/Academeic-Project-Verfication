import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../src');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(jsx|tsx|js)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

function addImport(src, file) {
  if (src.includes('lib/appDialog')) return src;
  const depth = file.replace(/\\/g, '/').split('/src/')[1].split('/').length - 1;
  const rel = `${'../'.repeat(depth)}lib/appDialog`;
  const imp = `import { appAlert, appConfirm, appError, appSuccess, appWarning } from '${rel}';\n`;
  const m = src.match(/^(import .+?;\r?\n)+/);
  if (m) return m[0] + imp + src.slice(m[0].length);
  return imp + src;
}

function migrate(src) {
  let out = src;

  out = out.replace(/if\s*\(\s*!window\.confirm\(/g, 'if (!(await appConfirm(');
  out = out.replace(/if\s*\(\s*!confirm\(/g, 'if (!(await appConfirm(');
  out = out.replace(/const\s+(\w+)\s*=\s*window\.confirm\(/g, 'const $1 = await appConfirm(');
  out = out.replace(/const\s+(\w+)\s*=\s*confirm\(/g, 'const $1 = await appConfirm(');

  out = out.replace(/window\.alert\(/g, 'APP_ALERT(');
  out = out.replace(/window\.confirm\(/g, 'APP_CONFIRM(');
  out = out.replace(/\balert\(/g, 'APP_ALERT(');
  out = out.replace(/\bconfirm\(/g, 'APP_CONFIRM(');

  // Validation / info strings
  out = out.replace(
    /APP_ALERT\((['"])([^'"]*(?:required|Please |Select |fill |already exists|first\.|Contact your|upload a file)[^'"]*)\1\)/gi,
    'await appWarning($1$2$1)'
  );
  out = out.replace(
    /APP_ALERT\((['"])([^'"]*(?:successfully|updated successfully|Assigned \d| copied)\b[^'"]*)\1\)/gi,
    'await appSuccess($1$2$1)'
  );

  // Template literals for success with variables
  out = out.replace(/APP_ALERT\(`([^`]*successfully[^`]*)`\)/gi, 'await appSuccess(`$1`)');
  out = out.replace(/APP_ALERT\(`([^`]*Assigned \$\{[^`]*)`\)/g, 'await appSuccess(`$1`)');
  out = out.replace(/APP_ALERT\(`([^`]*New passcode[^`]*)`\)/g, 'await appSuccess(`$1`)');
  out = out.replace(/APP_ALERT\(`([^`]*\$\{label\} copied[^`]*)`\)/g, 'await appSuccess(`$1`)');

  // Error expressions (dynamic)
  out = out.replace(/APP_ALERT\((err(?:or)?\.response\?\.data\?\.message[^)]*)\)/g, 'await appError($1)');
  out = out.replace(/APP_ALERT\((e\.response\?\.data\?\.message[^)]*)\)/g, 'await appError($1)');
  out = out.replace(/APP_ALERT\((error\.response\?\.data\?\.message[^)]*)\)/g, 'await appError($1)');
  out = out.replace(/APP_ALERT\((msg)\)/g, 'await appError($1)');
  out = out.replace(/APP_ALERT\((message)\)/g, 'await appError($1)');
  out = out.replace(/APP_ALERT\((r\.message[^)]*)\)/g, 'await appError($1)');
  out = out.replace(/APP_ALERT\((res\.message[^)]*)\)/g, 'await appError($1)');
  out = out.replace(/APP_ALERT\((response\.message[^)]*)\)/g, 'await appError($1)');
  out = out.replace(/APP_ALERT\((data\?\.(error|message)[^)]*)\)/g, 'await appError($1)');

  // Static error strings
  out = out.replace(
    /APP_ALERT\((['"])([^'"]*(?:Failed|Could not|not connected|Export failed|Preview failed|Delete not|Action failed|Stop failed|not available|error occurred|Try again|Update failed|Create failed|Delete failed|Generate failed|copy passcode)[^'"]*)\1\)/gi,
    'await appError($1$2$1)'
  );

  // Multi-line template errors
  out = out.replace(/APP_ALERT\(`([^`]+)`\)/g, 'await appAlert(`$1`)');

  // Remaining -> generic alert
  out = out.replace(/APP_ALERT\(/g, 'await appAlert(');
  out = out.replace(/APP_CONFIRM\(/g, 'await appConfirm(');

  // onClick handlers should not use await in non-async arrow - use void
  out = out.replace(/onClick=\{\(\) => await app/g, 'onClick={() => void app');

  return out;
}

const files = walk(root).filter((f) => {
  const t = fs.readFileSync(f, 'utf8');
  return /\b(alert|confirm)\(|window\.(alert|confirm)\(/.test(t);
});

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let next = addImport(original, file);
  next = migrate(next);
  if (next !== original) {
    fs.writeFileSync(file, next);
    console.log('updated', path.relative(root, file));
  }
}

console.log('done', files.length, 'files');
