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
        .replace(/[^a-z0-9]/g, '');
}

/** Normalize spreadsheet dates (Excel serials, DD/MM/YYYY, ISO) to YYYY-MM-DD. */
export function normalizeImportDate(value) {
    const raw = value;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        return raw.toISOString().split('T')[0];
    }

    const s = String(raw ?? '').trim();
    if (!s) return '';

    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        return s.slice(0, 10);
    }

    const serial = Number(s);
    if (/^\d+(\.\d+)?$/.test(s) && serial > 1000 && serial < 100000) {
        const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
        if (!Number.isNaN(utc.getTime())) {
            return utc.toISOString().split('T')[0];
        }
    }

    const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (dmy) {
        const day = Number(dmy[1]);
        const month = Number(dmy[2]);
        const year = Number(dmy[3]);
        const d = new Date(Date.UTC(year, month - 1, day));
        if (!Number.isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }
    }

    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }

    return '';
}

/** Match spreadsheet columns when headers vary (e.g. "Name of Father", "Father's Name"). */
function pickFromNormKeys(norm, { include = [], exclude = [] } = {}) {
    for (const [key, value] of Object.entries(norm || {})) {
        const text = String(value ?? '').trim();
        if (!text) continue;
        if (!include.every((part) => key.includes(part))) continue;
        if (exclude.some((part) => key.includes(part))) continue;
        return text;
    }
    return '';
}

function findDobInNorm(norm) {
    for (const [key, value] of Object.entries(norm || {})) {
        const text = String(value ?? '').trim();
        if (!text) continue;
        if (
            key === 'dob' ||
            key.includes('dateofbirth') ||
            key.includes('birthdate') ||
            (key.includes('birth') && !key.includes('place') && !key.includes('certificate'))
        ) {
            const normalized = normalizeImportDate(text);
            if (normalized) return normalized;
        }
    }
    return '';
}

function pickParentContact(norm, parent) {
    const hints = ['contact', 'phone', 'mobile', 'tel', 'cell', 'number'];
    for (const hint of hints) {
        const found = pickFromNormKeys(norm, { include: [parent, hint], exclude: [] });
        if (found) return found;
    }
    return '';
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
        classId: val('classid', 'classcode', 'class'),
        classCode: val('classcode', 'classid', 'class'),
        faculty: val('faculty', 'school'),
        department: val('department', 'dept', 'programme'),
        program: val('program', 'major'),
        photo: val('photo', 'photourl', 'image', 'profileimage'),
        phone: val('phone', 'phonenumber', 'mobile', 'tel', 'telephone', 'phoneno'),
        dob:
            normalizeImportDate(
                val(
                    'dob',
                    'dateofbirth',
                    'birthdate',
                    'birthday',
                    'datebirth',
                    'birth',
                    'studentdob',
                    'studentdateofbirth'
                )
            ) || findDobInNorm(norm),
        gender: val('gender', 'sex'),
        fatherName:
            val(
                'fathername',
                'fathersname',
                'fatherfullname',
                'fathersfullname',
                'nameoffather',
                'father',
                'parentfathername',
                'guardianfather'
            ) || pickFromNormKeys(norm, { include: ['father'], exclude: ['contact', 'phone', 'mobile', 'tel', 'email', 'number'] }),
        fatherContact:
            val(
                'fathercontact',
                'fatherscontact',
                'fatherphone',
                'fathersphone',
                'fathermobile',
                'fathersmobile',
                'fatherphonenumber',
                'fatherstel',
                'fathercell',
                'fathernumber'
            ) || pickParentContact(norm, 'father'),
        motherName:
            val(
                'mothername',
                'mothersname',
                'motherfullname',
                'mothersfullname',
                'nameofmother',
                'mother',
                'parentmothername',
                'guardianmother'
            ) || pickFromNormKeys(norm, { include: ['mother'], exclude: ['contact', 'phone', 'mobile', 'tel', 'email', 'number'] }),
        motherContact:
            val(
                'mothercontact',
                'motherscontact',
                'motherphone',
                'mothersphone',
                'mothermobile',
                'mothersmobile',
                'motherphonenumber',
                'motherstel',
                'mothercell',
                'mothernumber'
            ) || pickParentContact(norm, 'mother'),
        highSchoolName: val('highschoolname', 'highschool', 'schoolname'),
        highSchool: val('highschool', 'highschoolname', 'schoolname'),
        graduationYear: val('graduationyear', 'gradyear', 'yearofgraduation'),
        certificateUrl: val('certificateurl', 'certificate'),
        campus: val('campus', 'location'),
        studyMode: val('studymode', 'mode', 'studymethod'),
        entryDate: normalizeImportDate(val('entrydate', 'enrollmentdate', 'admissiondate')),
        currentScore: val('score', 'currentscore', 'mark'),
        currentGpa: val('gpa', 'currentgpa', 'cgpa'),
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
    const faculty = val('faculty', 'school', 'college');
    const department = val('department', 'dept', 'programme', 'program');
    return {
        name: val('name', 'fullname', 'teachername', 'instructor', 'teacher'),
        email: val('email', 'emailaddress', 'mail', 'e-mail'),
        teacherId: val('teacherid', 'employeeid', 'staffid', 'id'),
        employeeId: val('employeeid', 'teacherid', 'staffid'),
        password: val('password'),
        passcode: val('passcode', 'pin'),
        faculty,
        // Do not fall back to faculty here — keep them separate for structure sync.
        department: department || '',
        phone: val('phone', 'phonenumber', 'mobile', 'tel', 'telephone', 'phoneno'),
        skills: val('skills', 'skills&expertise', 'skillsexpertise', 'expertise', 'subjects'),
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
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
        if (!rows.length) throw new Error('Excel sheet is empty.');
        const headers = Object.keys(rows[0]);
        const lines = [
            headers.join(','),
            ...rows.map((row) =>
                headers
                    .map((h) => {
                        const cell = row[h] ?? '';
                        let s;
                        if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
                            s = cell.toISOString().split('T')[0];
                        } else {
                            s = String(cell).replace(/\r?\n/g, ' ').trim();
                        }
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
