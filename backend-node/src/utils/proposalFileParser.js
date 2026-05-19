/**
 * Parse proposal file text into title, description, and feature list.
 * Supports explicit labels (Title:, Description:, Features:) and common academic layouts.
 */

function normalizeLine(line) {
  return String(line || '').replace(/\r/g, '').trim();
}

function parseJsonProposal(text) {
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object') return null;
    const title = String(data.title || data.projectTitle || '').trim();
    const description = String(data.description || data.overview || '').trim();
    const features = []
      .concat(data.features || data.featureList || [])
      .map((f) => (typeof f === 'string' ? f : f?.name || f?.title || ''))
      .map((f) => String(f).trim())
      .filter(Boolean);
    if (!title && !description && !features.length) return null;
    return { title, description, features };
  } catch {
    return null;
  }
}

function isSkippableMetaLine(lower) {
  return (
    /^student\s+name\s*:/.test(lower) ||
    /^course\s*:/.test(lower) ||
    /^instructor\s*:/.test(lower) ||
    /^date\s*:/.test(lower) ||
    /^submitted\s*:/.test(lower)
  );
}

function parseTitleFromLine(trimmed) {
  const patterns = [
    /^(?:project\s+title|proposal\s+title|project\s+name)\s*:\s*(.+)$/i,
    /^title\s*:\s*(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return '';
}

function parseSectionHeader(trimmed) {
  const withoutNum = trimmed.replace(/^\d+\.\s*/, '').trim();
  const lower = withoutNum.toLowerCase();

  const titleInline = parseTitleFromLine(withoutNum);
  if (titleInline) return { section: 'title', inline: titleInline };

  const pick = (regex, section) => {
    const match = withoutNum.match(regex);
    if (!match) return null;
    const inline = (match[1] || '').trim();
    return { section, inline };
  };

  return (
    pick(/^(?:project\s+)?overview\s*:?\s*(.*)$/i, 'description') ||
    pick(/^description\s*:?\s*(.*)$/i, 'description') ||
    pick(/^(?:project\s+)?summary\s*:?\s*(.*)$/i, 'description') ||
    pick(/^(?:proposed\s+)?functionality\s*:?\s*(.*)$/i, 'features') ||
    pick(/^features?\s*:?\s*(.*)$/i, 'features') ||
    pick(/^key\s+features?\s*:?\s*(.*)$/i, 'features') ||
    pick(/^(?:technical\s+)?(?:tech\s+)?stack\s*:?\s*(.*)$/i, 'technical') ||
    pick(/^technologies?\s*:?\s*(.*)$/i, 'technical') ||
    (lower === 'features' || lower === 'feature list' ? { section: 'features', inline: '' } : null)
  );
}

function parseFeatureBullet(trimmed) {
  const bullet = trimmed.match(/^(?:[*\-•]|\d+\.)\s+(.+)$/);
  if (!bullet?.[1]) return '';
  let content = bullet[1].trim();
  content = content.replace(/^\*\s*/, '').trim();

  const colonIdx = content.indexOf(':');
  if (colonIdx > 0 && colonIdx < 80) {
    const label = content.slice(0, colonIdx).trim();
    const rest = content.slice(colonIdx + 1).trim();
    if (label.length >= 3 && label.length <= 100) {
      return rest.length > 140 ? label : content;
    }
  }
  return content;
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

export function parseStructuredProposalText(rawText) {
  const text = String(rawText || '').replace(/\r/g, '').trim();
  if (!text) {
    return { title: '', description: '', features: [] };
  }

  const jsonParsed = parseJsonProposal(text);
  if (jsonParsed) return jsonParsed;

  const lines = text.split('\n');
  let title = '';
  let description = '';
  const descriptionParts = [];
  const technicalParts = [];
  const features = [];
  let section = '';

  const pushDescription = (part) => {
    const v = String(part || '').trim();
    if (v) descriptionParts.push(v);
  };

  for (const rawLine of lines) {
    const trimmed = normalizeLine(rawLine);
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    if (isSkippableMetaLine(lower)) continue;

    if (/^title\s*:/i.test(trimmed) && !/^project\s+title/i.test(trimmed)) {
      section = 'title';
      title = trimmed.replace(/^title\s*:/i, '').trim();
      continue;
    }

    const titleFromLine = parseTitleFromLine(trimmed);
    if (titleFromLine) {
      title = titleFromLine;
      section = '';
      continue;
    }

    if (lower.startsWith('description:')) {
      section = 'description';
      pushDescription(trimmed.replace(/^description\s*:/i, '').trim());
      continue;
    }

    if (/^features?\s*:/i.test(trimmed)) {
      section = 'features';
      const inline = trimmed.replace(/^features?\s*:/i, '').trim();
      if (inline) features.push(inline);
      continue;
    }

    const header = parseSectionHeader(trimmed);
    if (header) {
      if (header.section === 'title' && header.inline) {
        title = header.inline;
        section = '';
        continue;
      }
      section = header.section;
      if (header.section === 'description' && header.inline) pushDescription(header.inline);
      if (header.section === 'features' && header.inline) features.push(header.inline);
      if (header.section === 'technical' && header.inline) technicalParts.push(header.inline);
      continue;
    }

    const featureText = parseFeatureBullet(trimmed);
    if (featureText && (section === 'features' || /^(?:[*\-•]|\d+\.)\s+/.test(trimmed))) {
      if (section !== 'technical') features.push(featureText);
      continue;
    }

    if (section === 'features') {
      const cleaned = trimmed.replace(/^[-*•]\s*/, '').trim();
      if (!cleaned) continue;
      const colonIdx = cleaned.indexOf(':');
      if (colonIdx > 0 && colonIdx < 80) {
        const label = cleaned.slice(0, colonIdx).trim();
        const rest = cleaned.slice(colonIdx + 1).trim();
        if (label.length >= 3 && label.length <= 100) {
          features.push(rest.length > 140 ? label : cleaned);
          continue;
        }
      }
      features.push(cleaned);
      continue;
    }

    if (section === 'technical') {
      technicalParts.push(trimmed);
      continue;
    }

    if (section === 'description' || section === '') {
      if (!title && section === '') {
        const maybeTitle = parseTitleFromLine(trimmed);
        if (maybeTitle) {
          title = maybeTitle;
          continue;
        }
        if (
          trimmed.length <= 120 &&
          !trimmed.endsWith('.') &&
          !/^\d+\./.test(trimmed) &&
          !isSkippableMetaLine(lower)
        ) {
          title = trimmed;
          section = 'description';
          continue;
        }
      }
      pushDescription(trimmed);
      continue;
    }

    if (section === 'title') {
      title = title ? `${title} ${trimmed}` : trimmed;
    }
  }

  if (technicalParts.length) {
    pushDescription(`Technical stack: ${technicalParts.join(' ')}`);
  }

  description = descriptionParts.join('\n\n').trim();

  if (!title && descriptionParts.length) {
    const firstLine = descriptionParts[0].split('\n')[0].trim();
    if (firstLine.length <= 120) {
      title = firstLine;
      description = descriptionParts.slice(1).join('\n\n').trim() || description;
    }
  }

  const parsedFeatures = uniqueFeatures(features);

  if (!parsedFeatures.length) {
    for (const rawLine of lines) {
      const trimmed = normalizeLine(rawLine);
      const featureText = parseFeatureBullet(trimmed);
      if (featureText) parsedFeatures.push(featureText);
    }
  }

  return {
    title: title.trim(),
    description: description.trim(),
    features: uniqueFeatures(parsedFeatures),
  };
}
