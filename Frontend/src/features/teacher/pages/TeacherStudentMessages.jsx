import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { Z_PAGE, Z_INNER, Z_CARD, Z_LINK } from '../../../shared/ui/zendentaLayout';
import { categoryLabel, statusBadge } from '../../../shared/components/StudentContactTeacherPanel';

const FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'replied', label: 'Replied' },
  { value: 'closed', label: 'Closed' },
];

const TeacherStudentMessages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [replyById, setReplyById] = useState({});
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await teacherService.listStudentMessages(filter ? { status: filter } : {});
      if (res.success) setMessages(res.data || []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const sendReply = async (messageId, close = false) => {
    const reply = String(replyById[messageId] || '').trim();
    if (!reply && !close) return;
    setBusyId(messageId);
    try {
      const res = await teacherService.replyStudentMessage(messageId, { reply, close });
      if (res.success) {
        setReplyById((prev) => ({ ...prev, [messageId]: '' }));
        await load();
      }
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className={Z_PAGE}>
      <div className={Z_INNER}>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Student messages</h1>
            <p className="text-sm text-slate-500">
              Deadline extension requests and questions from your students.
            </p>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#1e56e3]" />
          </div>
        ) : messages.length === 0 ? (
          <div className={`${Z_CARD} p-8 text-center`}>
            <MessageSquare className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No student messages in this view.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => {
              const badge = statusBadge(m.status);
              const assignmentId = m.assignment?._id || m.assignment;
              const studentName = m.student?.name || m.student?.email || 'Student';
              return (
                <li key={m._id} className={`${Z_CARD} p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">{m.subject}</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <strong>{studentName}</strong>
                        {' · '}
                        {m.assignment?.title || 'Assignment'}
                        {' · '}
                        {categoryLabel(m.category)}
                        {m.deadlineType ? ` (${m.deadlineType.replace('_', ' ')})` : ''}
                      </p>
                      {m.recipientLabel ? (
                        <p className="mt-1 text-[11px] font-semibold text-[#1e56e3]">Sent to: {m.recipientLabel}</p>
                      ) : null}
                      {m.recipientLabel ? (
                        <p className="mt-1 text-[11px] font-semibold text-indigo-700">{m.recipientLabel}</p>
                      ) : null}
                      <p className="text-[11px] text-slate-400">{new Date(m.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{m.message}</p>

                  {m.teacherReply ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                      <p className="text-[10px] font-bold uppercase text-emerald-700">Your reply</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">{m.teacherReply}</p>
                    </div>
                  ) : null}

                  {m.status !== 'closed' ? (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                        Reply to student
                      </label>
                      <textarea
                        value={replyById[m._id] || ''}
                        onChange={(e) => setReplyById((prev) => ({ ...prev, [m._id]: e.target.value }))}
                        rows={3}
                        placeholder="e.g. I extended the project deadline by 3 days. Check Assignments → Edit."
                        className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === m._id || !String(replyById[m._id] || '').trim()}
                          onClick={() => sendReply(m._id, false)}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#1e56e3] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {busyId === m._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Send reply
                        </button>
                        <button
                          type="button"
                          disabled={busyId === m._id}
                          onClick={() => sendReply(m._id, true)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Close without reply
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {assignmentId ? (
                    <Link
                      to={`/teacher/assignments/${assignmentId}`}
                      className={`${Z_LINK} mt-3 inline-block text-xs font-bold`}
                    >
                      Open assignment →
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TeacherStudentMessages;
