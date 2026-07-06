import React from 'react';
import { formatTeacherScoreDisplay } from '../utils/projectWorkflowStatus';

/** Renders one or more teacher feedback cards for students. */
export default function StudentProjectFeedbackPanel({ entries, className = '' }) {
  if (!entries?.length) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {entries.map((entry) => (
        <div
          key={entry.role}
          className="rounded-lg border border-violet-100 bg-violet-50/80 p-3 text-sm leading-relaxed text-violet-950"
        >
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">
            {entries.length > 1 ? entry.roleLabel : 'Teacher project feedback'}
          </p>
          {entry.scoreDisplay || entry.score != null ? (
            <p className="mb-2 font-bold">
              Score: {entry.scoreDisplay || formatTeacherScoreDisplay(entry.score, entry.scoreMax)}
            </p>
          ) : null}
          {entry.comment ? (
            <p className="whitespace-pre-wrap">{entry.comment}</p>
          ) : (
            <p className="text-violet-700">No written feedback.</p>
          )}
        </div>
      ))}
    </div>
  );
}
