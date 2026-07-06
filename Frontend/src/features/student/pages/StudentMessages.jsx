import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageSquare } from 'lucide-react';
import studentService from '../../../services/studentService';
import { Z_SHELL, Z_SHELL_INNER, Z_CARD, Z_LINK } from '../../../shared/ui/zendentaLayout';
import { categoryLabel, statusBadge } from '../../../shared/components/StudentContactTeacherPanel';

const StudentMessages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await studentService.listTeacherMessages();
      if (res.success) setMessages(res.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={Z_SHELL}>
      <div className={Z_SHELL_INNER}>
        <div className="mb-4">
          <h1 className="text-lg font-bold text-slate-900">Messages to teachers</h1>
          <p className="text-sm text-slate-500">
            Track deadline extension requests and replies from your teachers.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#1e56e3]" />
          </div>
        ) : messages.length === 0 ? (
          <div className={`${Z_CARD} p-8 text-center`}>
            <MessageSquare className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No messages yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Open an assignment and use <strong>Contact teacher</strong> to send a request.
            </p>
            <Link to="/student/assignments" className={`${Z_LINK} mt-4 inline-block text-sm font-bold`}>
              Go to assignments →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => {
              const badge = statusBadge(m.status);
              const assignmentId = m.assignment?._id || m.assignment;
              return (
                <li key={m._id} className={`${Z_CARD} p-4`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">{m.subject}</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {m.assignment?.title || 'Assignment'} · {categoryLabel(m.category)} ·{' '}
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                      {m.recipientLabel ? (
                        <p className="mt-1 text-xs font-semibold text-[#1e56e3]">To: {m.recipientLabel}</p>
                      ) : null}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{m.message}</p>
                  {m.teacherReply ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                      <p className="text-[10px] font-bold uppercase text-emerald-700">Teacher reply</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">{m.teacherReply}</p>
                      {m.teacherRepliedAt ? (
                        <p className="mt-1 text-xs text-emerald-700">
                          {new Date(m.teacherRepliedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {assignmentId ? (
                    <Link
                      to={`/student/assignments/${assignmentId}`}
                      className={`${Z_LINK} mt-3 inline-block text-xs font-bold`}
                    >
                      View assignment →
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

export default StudentMessages;
