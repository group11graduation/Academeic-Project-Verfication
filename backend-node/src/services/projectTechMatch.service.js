/**
 * Ensure the uploaded project ZIP's detected stack matches the approved proposal / assignment tech.
 * Rule-based (file signals via detectProjectStackWithMeta) — no ML.
 */

import * as dockerOrchestrator from './dockerOrchestrator.service.js';
import {
  canonicalizeTechList,
  detectMentionedTechnologies,
  expandTechFamily,
  resolveRequiredTechnologiesForProposal,
  techFamiliesOverlap,
} from './requirementCheck.service.js';

/** Map preview stack ids → canonical tech families the ZIP represents. */
const STACK_TO_TECH = {
  'php-apache': ['php', 'mysql', 'laravel'],
  'node-js': ['node.js', 'react'],
  'java-spring-react': ['java', 'spring boot', 'react'],
  'static-html': [],
  'static-html-js': [],
  jupyter: ['python'],
  'node-js-flutter': ['flutter', 'node.js'],
};

export function approvedTechnologiesForProposal(assignment, proposal) {
  const fromMatched = canonicalizeTechList(proposal?.requirementAllowedTechMatched || []);
  const fromAssignment = resolveRequiredTechnologiesForProposal(assignment, assignment);
  const fromProposalText = detectMentionedTechnologies(
    [
      proposal?.title || '',
      proposal?.description || '',
      ...(Array.isArray(proposal?.features) ? proposal.features : []),
    ].join(' ')
  );
  const fromSemantic = canonicalizeTechList(
    Array.isArray(assignment?.allowedTechnologies) ? assignment.allowedTechnologies : []
  );

  const merged = [...new Set([...fromMatched, ...fromAssignment, ...fromProposalText, ...fromSemantic])];
  return merged;
}

export function technologiesForDetectedStack(stack) {
  const key = String(stack || '').trim().toLowerCase();
  return STACK_TO_TECH[key] || [];
}

/**
 * @returns {{ ok: boolean, message?: string, detectedStack?: string, approvedTech?: string[], zipTech?: string[] }}
 */
export async function assertZipMatchesApprovedTechnology({
  extractDir,
  assignment,
  proposal,
  stackHint = '',
} = {}) {
  const approvedTech = approvedTechnologiesForProposal(assignment, proposal);
  if (!approvedTech.length) {
    return { ok: true, approvedTech: [], skipped: true };
  }

  const meta = await dockerOrchestrator.detectProjectStackWithMeta(extractDir, {
    stackHint: stackHint || undefined,
  });
  const detectedStack = meta?.stack || '';
  const zipTech = technologiesForDetectedStack(detectedStack);

  // Static HTML / unknown: cannot prove mismatch — allow but annotate.
  if (!detectedStack || !zipTech.length) {
    return {
      ok: true,
      detectedStack: detectedStack || 'unknown',
      approvedTech,
      zipTech,
      skipped: true,
      message: 'Could not confidently detect a framework stack in the ZIP; technology match skipped.',
    };
  }

  if (techFamiliesOverlap(approvedTech, zipTech)) {
    return {
      ok: true,
      detectedStack,
      approvedTech,
      zipTech,
      message: `Detected ${detectedStack} matches approved technologies (${approvedTech.join(', ')}).`,
    };
  }

  const approvedLabel = approvedTech.join(', ');
  const zipLabel = zipTech.join(', ');
  return {
    ok: false,
    detectedStack,
    approvedTech,
    zipTech,
    message:
      `Project ZIP technology mismatch: the approved proposal / assignment expects (${approvedLabel}), ` +
      `but the uploaded archive looks like ${detectedStack} (${zipLabel}). ` +
      `Upload code that matches the approved technology stack.`,
  };
}
