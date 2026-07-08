import * as XLSX from 'xlsx';

/** Split one CSV row respecting quoted fields (RFC-style). */
export function parseCsvLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const c = line[i];
        if (inQuotes) {
            if (c === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                cur += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += c;
        }
    }
    result.push(cur.trim());
    return result;
}

/** Parse whole CSV / pasted text into row objects (first row = headers). */
export function parseCsvToRecords(text) {
    const lines = String(text || '').trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/^\ufeff/, ''));
    return lines.slice(1).map((line) => {
        const cells = parseCsvLine(line);
        const row = {};
        headers.forEach((h, i) => {
            row[h] = cells[i] ?? '';
        });
        return row;
    });
}

function canonicalKey(k) {
    return String(k ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '');
}

function headerLooksLikeStudentRow(headers) {
    const keys = headers.map((h) => canonicalKey(h));
    const hasName = keys.some((k) => ['name', 'fullname', 'studentname', 'student'].includes(k));
    const hasEmail = keys.some((k) => ['email', 'emailaddress', 'mail'].includes(k));
    return hasName && hasEmail;
}

/** Prepend standard header when paste omits it (common in bulk copy from Excel). */
export function ensureStudentImportHeader(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return trimmed;
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return trimmed;
    const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/^\ufeff/, ''));
    if (headerLooksLikeStudentRow(headers)) return trimmed;
    return `name,email,studentId\n${trimmed}`;
}

/** Student bulk import — auto-detects missing header row. */
export function parseStudentCsvToRecords(text) {
    return parseCsvToRecords(ensureStudentImportHeader(text));
}

/** Map messy spreadsheet headers to import fields (CSV or Excel). */
export function normalizeStudentImportRow(raw) {
    const norm = {};
    for (const [k, v] of Object.entries(raw || {})) {
        norm[canonicalKey(k)] = v;
    }
    const val = (...aliases) => {
        for (const a of aliases) {
            const key = canonicalKey(a);
            const v = norm[key];
            if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
        }
        return '';
    };
    return {
        name: val('name', 'fullname', 'studentname', 'student', 'student full name'),
        email: val('email', 'emailaddress', 'mail', 'e-mail'),
        studentId: val('studentid', 'id', 'studentnumber', 'matric', 'matricno', 'registrationnumber'),
        password: val('password', 'passwd'),
        passcode: val('passcode', 'pin', 'logincode'),
    };
}

/** Required columns for student bulk import: name, email, studentId */
export function validateStudentImportRows(rows) {
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        const line = i + 2;
        if (!String(row.name || '').trim()) {
            return `Row ${line}: name is required`;
        }
        if (!String(row.email || '').trim()) {
            return `Row ${line}: email is required`;
        }
        if (!String(row.studentId || '').trim()) {
            return `Row ${line}: student ID is required`;
        }
    }
    return null;
}

export function normalizeTeacherImportRow(raw) {
    const norm = {};
    for (const [k, v] of Object.entries(raw || {})) {
        norm[canonicalKey(k)] = v;
    }
    const val = (...aliases) => {
        for (const a of aliases) {
            const key = canonicalKey(a);
            const v = norm[key];
            if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
        }
        return '';
    };
    return {
        name: val('name', 'fullname', 'teachername', 'instructor'),
        email: val('email', 'emailaddress', 'mail'),
        teacherId: val('teacherid', 'employeeid', 'staffid', 'id'),
        employeeId: val('employeeid', 'teacherid', 'staffid'),
        password: val('password'),
        passcode: val('passcode', 'pin'),
        department: val('department', 'faculty', 'school'),
        phone: val('phone', 'mobile', 'tel', 'telephone'),
        skills: val('skills', 'subjects', 'expertise'),
    };
}

/**
 * Read CSV as UTF-8 text, or parse Excel to a simple CSV string (first sheet).
 */
export async function readSpreadsheetFileAsCsvText(file) {
    if (!file) return '';
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) throw new Error('Excel file has no sheets.');
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) throw new Error('Excel sheet is empty.');
        const headers = Object.keys(rows[0]);
        const lines = [
            headers.join(','),
            ...rows.map((row) =>
                headers
                    .map((h) => {
                        const cell = row[h] ?? '';
                        const s = String(cell).replace(/\r?\n/g, ' ').trim();
                        if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
                        return s;
                    })
                    .join(',')
            ),
        ];
        return lines.join('\n');
    }
    return file.text();
}
