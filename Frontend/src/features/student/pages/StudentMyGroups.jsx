import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Loader2, Users, BookOpen, User } from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import studentService from '../../../services/studentService';
import { buildStudentGroupsBySubject } from '../../../shared/utils/studentGroupsBySubject';
import { Z_SHELL, Z_CARD } from '../../../shared/ui/zendentaLayout';

const StudentMyGroups = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await studentService.getAssignments();
        if (res.success) {
          const list = Array.isArray(res.data) ? res.data : res.data?.assignments || [];
          setRows(list);
        } else {
          setError(res.message || 'Failed to load groups');
        }
      } catch (e) {
        setError(e?.response?.data?.message || e.message || 'Failed to load groups');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(
    () => buildStudentGroupsBySubject(rows, user?._id || user?.id),
    [rows, user]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-9 w-9 animate-spin text-[#2a3fa4]" />
      </div>
    );
  }

  return (
    <div className={`${Z_SHELL} space-y-4`}>
      <div>
        <h1 className="text-xl font-black text-[var(--sv-text)] dark:text-slate-100">My groups</h1>
        <p className="mt-1 text-[12px] font-medium text-[var(--sv-muted)] dark:text-[var(--sv-muted)]">
          Groups are listed by subject. You can see who is the leader (you or a classmate) on each
          assignment.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {grouped.totalGroups === 0 ? (
        <div className={`${Z_CARD} p-8 text-center`}>
          <Users className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-[var(--sv-text)] dark:text-slate-200">
            You are not in any group yet
          </p>
          <p className="mt-1 text-[12px] text-[var(--sv-muted)]">
            When a teacher creates group-mode assignments and places you in a team, they will show
            here by subject.
          </p>
          <Link
            to="/student/assignments"
            className="mt-4 inline-flex text-[12px] font-bold text-[#2a3fa4] hover:underline"
          >
            Browse assignments →
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.subjects.map((subject) => (
            <section key={subject.subjectId} className={`${Z_CARD} overflow-hidden`}>
              <header className="flex items-center gap-2 border-b border-[var(--sv-border)] bg-[var(--sv-card-muted)] px-4 py-3 dark:border-white/10 dark:bg-[#0f172a]">
                <BookOpen className="h-4 w-4 text-[#2a3fa4]" />
                <div className="min-w-0">
                  <h2 className="truncate text-[13px] font-black text-[var(--sv-text)] dark:text-slate-100">
                    {subject.subjectName}
                    {subject.subjectCode ? (
                      <span className="ml-2 text-[11px] font-bold text-[var(--sv-muted)]">
                        ({subject.subjectCode})
                      </span>
                    ) : null}
                  </h2>
                  <p className="text-[10px] font-semibold text-[var(--sv-muted)]">
                    {subject.groups.length} group{subject.groups.length === 1 ? '' : 's'}
                  </p>
                </div>
              </header>

              <div className="divide-y divide-slate-100 dark:divide-white/10">
                {subject.groups.map((g) => (
                  <div key={`${subject.subjectId}-${g.groupId}`} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-black text-[var(--sv-text)] dark:text-slate-100">
                          {g.groupName}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-[var(--sv-muted)]">
                          Assignment: {g.assignmentTitle}
                          {g.isCollaborative ? ' · Collaborative' : ''}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                          g.youAreLeader
                            ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                            : 'bg-[var(--sv-card-muted)] text-[var(--sv-muted)] ring-1 ring-[var(--sv-border)] dark:bg-[#0f172a] dark:text-slate-300 dark:ring-white/10'
                        }`}
                      >
                        {g.youAreLeader ? (
                          <>
                            <Crown className="h-3 w-3" /> You are the leader
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3" /> Member
                          </>
                        )}
                      </span>
                    </div>

                    <div className="mt-2 rounded-lg bg-[var(--sv-card-muted)] px-3 py-2 dark:bg-[#0f172a]">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--sv-muted)]">
                        Group leader
                      </p>
                      <p className="mt-0.5 text-[12px] font-bold text-[var(--sv-text)] dark:text-slate-100">
                        {g.leaderName}
                        {g.youAreLeader ? ' (you)' : ''}
                      </p>
                    </div>

                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {g.members.map((m) => (
                        <li
                          key={String(m._id || m.name)}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            m.role === 'leader'
                              ? 'bg-amber-100/80 text-amber-900'
                              : 'bg-[var(--sv-card)] text-[var(--sv-muted)] ring-1 ring-[var(--sv-border)] dark:bg-transparent dark:text-slate-300 dark:ring-white/10'
                          }`}
                        >
                          {m.name || 'Student'}
                          {m.studentId ? ` · ${m.studentId}` : ''}
                          {m.isYou ? ' · you' : ''}
                          {m.role === 'leader' ? ' · lead' : ''}
                        </li>
                      ))}
                    </ul>

                    {g.assignmentId ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        <Link
                          to={`/student/assignments/${g.assignmentId}/proposal`}
                          className="text-[11px] font-bold text-[#2a3fa4] hover:underline"
                        >
                          Open proposal →
                        </Link>
                        <Link
                          to={`/student/project/${g.assignmentId}`}
                          className="text-[11px] font-bold text-[var(--sv-muted)] hover:text-[#2a3fa4] hover:underline"
                        >
                          Project workspace
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentMyGroups;
