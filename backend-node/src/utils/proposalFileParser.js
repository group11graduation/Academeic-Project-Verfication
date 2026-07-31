/**
 * Parse proposal file text into title, description, and feature list.
 *
 * Strict mode (default for student uploads): the file MUST include labeled
 * Title, Description, and Features sections. Labels may appear in any order
 * and anywhere in the document (other headings/meta lines are ignored).
 *
 * Supported shapes:
 *   Title: My project
 *   Description: ...
 *   Features:
 *   - Feature one
 *   - Feature two
 *
 *   JSON: { "title": "...", "description": "...", "features": ["..."] }
 *   CSV header: title,description,features
 */

function normalizeLine(line) {
  return String(line || '').replace(/\r/g, '').trim();
}

function uniqueFeatures(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function parseJsonProposal(text) {
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const title = String(data.title || data.projectTitle || data.Title || '').trim();
    const description = String(
      data.description || data.Description || data.overview || data.Overview || ''
    ).trim();
    const features = []
      .concat(data.features || data.Features || data.featureList || [])
      .map((f) => (typeof f === 'string' ? f : f?.name || f?.title || ''))
      .map((f) => String(f).trim())
      .filter(Boolean);
    if (!title && !description && !features.length) return null;
    return { title, description, features: uniqueFeatures(features), format: 'json' };
  } catch {
    return null;
  }
}

function parseCsvProposal(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const splitCsv = (line) => {
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = splitCsv(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const titleIdx = headers.findIndex((h) => h === 'title' || h === 'projecttitle');
  const descIdx = headers.findIndex((h) => h === 'description' || h === 'overview');
  const featIdx = headers.findIndex((h) => h === 'features' || h === 'featurelist');
  if (titleIdx < 0 || descIdx < 0 || featIdx < 0) return null;

  const row = splitCsv(lines[1]);
  const title = String(row[titleIdx] || '').trim();
  const description = String(row[descIdx] || '').trim();
  const featuresRaw = String(row[featIdx] || '').trim();
  const features = uniqueFeatures(
    featuresRaw
      .split(/[|;]+/)
      .map((f) => f.trim())
      .filter(Boolean)
  );
  if (!title && !description && !features.length) return null;
  return { title, description, features, format: 'csv' };
}

/** Detect a section label line; returns { key, inline } or null. */
function matchSectionLabel(trimmed) {
  const cleaned = trimmed
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\d+[\.)]\s*/, '')
    .replace(/^\*\*?/, '')
    .replace(/\*\*?$/, '')
    .trim();

  const patterns = [
    {
      key: 'title',
      re: /^(?:project\s+)?title\s*:?\s*(.*)$/i,
    },
    {
      key: 'title',
      re: /^(?:proposal\s+title|project\s+name)\s*:?\s*(.*)$/i,
    },
    {
      key: 'description',
      re: /^(?:project\s+)?description\s*:?\s*(.*)$/i,
    },
    {
      key: 'description',
      re: /^(?:project\s+)?overview\s*:?\s*(.*)$/i,
    },
    {
      key: 'description',
      re: /^(?:project\s+)?summary\s*:?\s*(.*)$/i,
    },
    {
      key: 'features',
      re: /^(?:key\s+)?features?\s*:?\s*(.*)$/i,
    },
    {
      key: 'features',
      re: /^(?:feature\s+list|proposed\s+functionality|functionality)\s*:?\s*(.*)$/i,
    },
  ];

  for (const { key, re } of patterns) {
    const match = cleaned.match(re);
    if (!match) continue;
    // Bare word "Title" / "Features" without colon only counts if whole line is the label
    const hasColon = /:/.test(cleaned);
    const inline = String(match[1] || '').trim();
    if (!hasColon && inline) {
      // "Title My App" without colon — treat whole remainder as inline value
      return { key, inline };
    }
    if (!hasColon && !inline) {
      // Line is exactly "Title" / "Description" / "Features"
      return { key, inline: '' };
    }
    if (hasColon) return { key, inline };
  }
  return null;
}

function isSkippableMetaLine(lower) {
  return (
    /^student\s+name\s*:/.test(lower) ||
    /^course\s*:/.test(lower) ||
    /^instructor\s*:/.test(lower) ||
    /^date\s*:/.test(lower) ||
    /^submitted\s*:/.test(lower) ||
    /^class\s*:/.test(lower) ||
    /^subject\s*:/.test(lower)
  );
}

function parseFeatureBullet(trimmed) {
  const bullet = trimmed.match(/^(?:[*\-•]|\d+[\.)])\s+(.+)$/);
  if (!bullet?.[1]) return '';
  return bullet[1].trim().replace(/^\*\s*/, '').trim();
}

function splitInlineFeatures(inline) {
  if (!inline) return [];
  // Prefer bullets already split; otherwise comma/semicolon lists
  if (/[;|]/.test(inline)) {
    return inline.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
  }
  if (inline.includes(',') && inline.length < 300) {
    const parts = inline.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) return parts;
  }
  return [inline];
}

/**
 * Label-first parse: find Title / Description / Features anywhere, in any order.
 */
function parseLabeledSections(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let title = '';
  const descriptionParts = [];
  const features = [];
  let section = '';
  let sawTitleLabel = false;
  let sawDescriptionLabel = false;
  let sawFeaturesLabel = false;

  for (const rawLine of lines) {
    const trimmed = normalizeLine(rawLine);
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (isSkippableMetaLine(lower)) continue;

    const label = matchSectionLabel(trimmed);
    if (label) {
      section = label.key;
      if (label.key === 'title') {
        sawTitleLabel = true;
        if (label.inline) title = label.inline;
      } else if (label.key === 'description') {
        sawDescriptionLabel = true;
        if (label.inline) descriptionParts.push(label.inline);
      } else if (label.key === 'features') {
        sawFeaturesLabel = true;
        for (const f of splitInlineFeatures(label.inline)) features.push(f);
      }
      continue;
    }

    if (section === 'title') {
      title = title ? `${title} ${trimmed}` : trimmed;
      continue;
    }
    if (section === 'description') {
      descriptionParts.push(trimmed);
      continue;
    }
    if (section === 'features') {
      const bullet = parseFeatureBullet(trimmed);
      const cleaned = (bullet || trimmed.replace(/^[-*•]\s*/, '')).trim();
      if (cleaned) features.push(cleaned);
    }
  }

  return {
    title: title.trim(),
    description: descriptionParts.join('\n\n').trim(),
    features: uniqueFeatures(features),
    sawTitleLabel,
    sawDescriptionLabel,
    sawFeaturesLabel,
    format: 'labeled',
  };
}

export const STRUCTURED_PROPOSAL_TEMPLATE = `Title: Your project title here

Description: Write a clear overview of what the project does, who it is for, and the main problem it solves.

Features:
- Feature one
- Feature two
- Feature three
`;

export const STRUCTURED_PROPOSAL_HELP =
  'Your file must include labeled sections Title, Description, and Features (in any order). Example:\n\n' +
  STRUCTURED_PROPOSAL_TEMPLATE.trim();

/**
 * Validate that parsed fields are present and non-empty.
 * @throws Error with status 400
 */
export function assertStructuredProposalFields(parsed, { requireLabels = false } = {}) {
  const title = String(parsed?.title || '').trim();
  const description = String(parsed?.description || '').trim();
  const features = uniqueFeatures(parsed?.features || []);

  const missing = [];
  if (!title) missing.push('Title');
  if (!description) missing.push('Description');
  if (!features.length) missing.push('Features');

  if (requireLabels) {
    const labelMissing = [];
    if (!parsed?.sawTitleLabel && parsed?.format === 'labeled') labelMissing.push('Title:');
    if (!parsed?.sawDescriptionLabel && parsed?.format === 'labeled') labelMissing.push('Description:');
    if (!parsed?.sawFeaturesLabel && parsed?.format === 'labeled') labelMissing.push('Features:');
    if (labelMissing.length) {
      const err = new Error(
        `Proposal file is missing required labels: ${labelMissing.join(', ')}. ${STRUCTURED_PROPOSAL_HELP}`
      );
      err.status = 400;
      err.code = 'PROPOSAL_FILE_MISSING_LABELS';
      throw err;
    }
  }

  if (missing.length) {
    const err = new Error(
      `Could not extract ${missing.join(', ')} from the file. ${STRUCTURED_PROPOSAL_HELP}`
    );
    err.status = 400;
    err.code = 'PROPOSAL_FILE_INCOMPLETE';
    throw err;
  }

  if (title.length < 3) {
    const err = new Error('Title must be at least 3 characters.');
    err.status = 400;
    throw err;
  }
  if (description.length < 20) {
    const err = new Error('Description must be at least 20 characters.');
    err.status = 400;
    throw err;
  }

  return { title, description, features };
}

/**
 * @param {string} rawText
 * @param {{ strict?: boolean }} [options] - strict=true requires labeled Title/Description/Features
 */
export function parseStructuredProposalText(rawText, options = {}) {
  const strict = options.strict !== false;
  const text = String(rawText || '').replace(/\r/g, '').trim();
  if (!text) {
    return {
      title: '',
      description: '',
      features: [],
      sawTitleLabel: false,
      sawDescriptionLabel: false,
      sawFeaturesLabel: false,
      format: 'empty',
    };
  }

  const jsonParsed = parseJsonProposal(text);
  if (jsonParsed) {
    return {
      ...jsonParsed,
      sawTitleLabel: Boolean(jsonParsed.title),
      sawDescriptionLabel: Boolean(jsonParsed.description),
      sawFeaturesLabel: Boolean(jsonParsed.features.length),
    };
  }

  const csvParsed = parseCsvProposal(text);
  if (csvParsed) {
    return {
      ...csvParsed,
      sawTitleLabel: Boolean(csvParsed.title),
      sawDescriptionLabel: Boolean(csvParsed.description),
      sawFeaturesLabel: Boolean(csvParsed.features.length),
    };
  }

  const labeled = parseLabeledSections(text);

  if (strict) {
    return labeled;
  }

  // Lenient fallback (legacy): only used when strict=false
  if (!labeled.title || !labeled.description || !labeled.features.length) {
    const lines = text.split('\n').map(normalizeLine).filter(Boolean);
    if (!labeled.title && lines[0] && lines[0].length <= 120) {
      labeled.title = lines[0];
    }
    if (!labeled.description && lines.length > 1) {
      labeled.description = lines.slice(1).join('\n\n');
    }
  }
  return labeled;
}
