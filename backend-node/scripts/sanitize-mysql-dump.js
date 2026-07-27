#!/usr/bin/env node
/** Sanitize phpMyAdmin dumps so mysql2 / mariadb multi-statements can run them. */
'use strict';
const fs = require('fs');

const src = process.argv[2] || '/app/database/payroll.sql';
const dst = process.argv[3] || '/tmp/payroll_clean.sql';

let s = fs.readFileSync(src, 'utf8');
s = s.replace(/DEFINER\s*=\s*`[^`]+`@`[^`]+`/gi, '');
s = s.replace(/DEFINER\s*=\s*'[^']+'@'[^']+'/gi, '');
s = s.replace(/^\s*USE\s+[`'"]?\w+[`'"]?\s*;/gim, '');
s = s.replace(/^DELIMITER\s+.+$/gim, '');
s = s.replace(/CREATE\s+(DEFINER\s*=\s*\S+\s+)?PROCEDURE[\s\S]*?END\s*\$\$/gi, '');
s = s.replace(/CREATE\s+(DEFINER\s*=\s*\S+\s+)?FUNCTION[\s\S]*?END\s*\$\$/gi, '');
s = s.replace(/CREATE\s+(DEFINER\s*=\s*\S+\s+)?TRIGGER[\s\S]*?END\s*\$\$/gi, '');
s = s.replace(/\$\$/g, ';');
fs.writeFileSync(dst, s);
console.log('wrote', dst, 'bytes', s.length);
