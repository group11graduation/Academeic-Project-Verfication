/**
 * Build subject → groups view from student assignment rows.
 * Each group-mode assignment with a `group` becomes one card under its subject(s).
 */

function subjectMeta(subject) {
  if (!subject) return null;
  const id = String(subject._id || subject || '');
  if (!id || id === 'undefined' || id === 'null') return null;
  return {
    id,
    name: subject.name || 'Subject',
    code: subject.code || '',
  };
}

function memberLabel(user) {
  if (!user) return 'Unknown';
  const name = user.name || 'Student';
  const sid = user.studentId ? ` (${user.studentId})` : '';
  return `${name}${sid}`;
}

/**
 * @param {Array} rows - assignment overview rows from GET /student/assignments
 * @param {string} currentUserId
 * @returns {{ subjects: Array<{ subjectId, subjectName, subjectCode, groups: Array }> }}
 */
export function buildStudentGroupsBySubject(rows, currentUserId) {
  const bySubject = new Map();
  const seenGroupKeys = new Set();

  for (const row of rows || []) {
    const assignment = row?.assignment || {};
    if (String(assignment.submissionMode || '') !== 'group') continue;
    const group = row?.group;
    if (!group?._id) continue;

    const subjects = [
      subjectMeta(assignment.subject),
      subjectMeta(assignment.frontendSubject),
      subjectMeta(assignment.backendSubject),
      ...(Array.isArray(assignment.collabSubjects)
        ? assignment.collabSubjects.map(subjectMeta)
        : []),
    ].filter(Boolean);

    // Deduplicate subjects for this assignment
    const uniqueSubjects = [];
    const seenSid = new Set();
    for (const s of subjects) {
      if (seenSid.has(s.id)) continue;
      seenSid.add(s.id);
      uniqueSubjects.push(s);
    }
    if (!uniqueSubjects.length) {
      uniqueSubjects.push({ id: 'unknown', name: 'Other', code: '' });
    }

    const leaderId = String(group.leader?._id || group.leader || '');
    const youAreLeader =
      row.isGroupLeader === true ||
      (currentUserId && leaderId === String(currentUserId));

    const members = [];
    if (group.leader) {
      members.push({
        ...group.leader,
        role: 'leader',
        isYou: leaderId === String(currentUserId || ''),
      });
    }
    for (const m of group.members || []) {
      const u = m?.user || m;
      const uid = String(u?._id || u || '');
      if (!uid || uid === leaderId) continue;
      members.push({
        ...u,
        role: 'member',
        isYou: uid === String(currentUserId || ''),
      });
    }

    const card = {
      groupId: String(group._id),
      groupName: group.name || 'Group',
      assignmentId: String(assignment._id || ''),
      assignmentTitle: assignment.title || 'Assignment',
      isCollaborative: Boolean(assignment.isCollaborative),
      youAreLeader,
      leaderName: memberLabel(group.leader),
      leaderId,
      members,
      memberCount: members.length,
    };

    for (const sub of uniqueSubjects) {
      const dedupeKey = `${sub.id}:${card.groupId}`;
      if (seenGroupKeys.has(dedupeKey)) continue;
      seenGroupKeys.add(dedupeKey);

      if (!bySubject.has(sub.id)) {
        bySubject.set(sub.id, {
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          groups: [],
        });
      }
      bySubject.get(sub.id).groups.push(card);
    }
  }

  const subjects = Array.from(bySubject.values()).sort((a, b) =>
    String(a.subjectName).localeCompare(String(b.subjectName), undefined, { sensitivity: 'base' })
  );

  return {
    subjects,
    totalGroups: subjects.reduce((n, s) => n + s.groups.length, 0),
  };
}
