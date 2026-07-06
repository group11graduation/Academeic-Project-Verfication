import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import studentService from '../../services/studentService';
import { Z_CARD, Z_BTN_PRIMARY } from '../ui/zendentaLayout';

const CATEGORY_OPTIONS = [
  { value: 'deadline_extension', label: 'Request deadline extension' },
  { value: 'general', label: 'General question' },
  { value: 'submission_help', label: 'Help with submission' },
  { value: 'feedback_question', label: 'Question about feedback' },
];

const DEADLINE_TYPE_OPTIONS = [
  { value: 'proposal', label: 'Proposal deadline' },
  { value: 'project', label: 'Project deadline' },
  { value: 'normal_submission', label: 'Assignment submission deadline' },
];

function categoryLabel(value) {
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label || value;
}

function statusBadge(status) {
  if (status === 'replied') return { text: 'Teacher replied', cls: 'bg-emerald-100 text-emerald-800' };
  if (status === 'closed') return { text: 'Closed', cls: 'bg-slate-100 text-slate-600' };
  return { text: 'Waiting for teacher', cls: 'bg-amber-100 text-amber-900' };
}

function buildRecipientOptions(teachers = []) {
  if (!Array.isArray(teachers) || teachers.length <= 1) {
    return [{ value: 'primary', label: teachers[0]?.name ? `Teacher — ${teachers[0].name}` : 'Teacher' }];
  }

  const frontend = teachers.find((t) => /frontend/i.test(t.roleLabel || '')) || teachers[0];
  const backend = teachers.find((t) => /backend/i.test(t.roleLabel || '')) || teachers[1];

  return [
    {
      value: 'frontend',
      label: `Frontend teacher — ${frontend?.name || 'Teacher 1'}`,
    },
    {
      value: 'backend',
      label: `Backend teacher — ${backend?.name || 'Teacher 2'}`,
    },
    {
      value: 'both',
      label: `Both teachers — ${frontend?.name || 'Teacher 1'} + ${backend?.name || 'Teacher 2'}`,
    },
  ];
}

/**
 * Student → teacher requests (deadline extension, questions, etc.)
 */
export default function StudentContactTeacherPanel({
  assignmentId,
  assignmentTitle,
  teacherName,
  teachers = [],
  showDeadlineHint = false,
  compact = false,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [category, setCategory] = useState(showDeadlineHint ? 'deadline_extension' : 'general');
  const [deadlineType, setDeadlineType] = useState('project');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const recipientOptions = useMemo(() => buildRecipientOptions(teachers), [teachers]);
  const isCollab = recipientOptions.length > 1;
  const [recipientTarget, setRecipientTarget] = useState(
    isCollab ? 'both' : 'primary'
  );

  useEffect(() => {
    setRecipientTarget(isCollab ? 'both' : 'primary');
  }, [isCollab, assignmentId]);

  const selectedRecipientLabel =
    recipientOptions.find((o) => o.value === recipientTarget)?.label || teacherName || 'your teacher';

  const load = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    setError('');
    try {
      const res = await studentService.listTeacherMessages({ assignmentId });
      if (res.success) setMessages(res.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (category === 'deadline_extension' && assignmentTitle && !subject) {
      setSubject(`Deadline extension — ${assignmentTitle}`);
    }
  }, [category, assignmentTitle, subject]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignmentId) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const res = await studentService.sendTeacherMessage({
        assignmentId,
        category,
        subject: subject.trim(),
        message: message.trim(),
        deadlineType: category === 'deadline_extension' ? deadlineType : '',
        recipientTarget,
      });
      if (res.success) {
        setSuccess(
          recipientTarget === 'both'
            ? 'Message sent to both teachers.'
            : 'Message sent to your teacher.'
        );
        setMessage('');
        if (category !== 'deadline_extension') setSubject('');
        await load();
      } else {
        setError(res.message || 'Could not send message.');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={compact ? '' : `${Z_CARD} p-4`}>
      <div className="mb-3 flex items-start gap-2">
        <MessageSquare className="h-5 w-5 shrink-0 text-[#1e56e3]" />
        <div>
          <h2 className="text-sm font-bold text-slate-900">Contact teacher</h2>
          <p className="text-xs text-slate-500">
            {isCollab
              ? 'Choose which teacher to contact, or send to both together.'
              : `Request a deadline extension or ask ${teacherName || 'your teacher'} for help.`}
          </p>
        </div>
      </div>

      {showDeadlineHint ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          A deadline has passed. You can ask your teacher to extend it or explain your situation below.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-3">
        {isCollab ? (
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Send to</label>
            <select
              value={recipientTarget}
              onChange={(e) => setRecipientTarget(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            >
              {recipientOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              {recipientTarget === 'both'
                ? 'Both teachers will see this message and either one can reply.'
                : `Only ${selectedRecipientLabel} will receive this message.`}
            </p>
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Topic</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {category === 'deadline_extension' ? (
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Which deadline?</label>
            <select
              value={deadlineType}
              onChange={(e) => setDeadlineType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {DEADLINE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            required
            placeholder="Short title for your request"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            required
            maxLength={4000}
            placeholder="Explain why you need an extension or what you need help with…"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
        {success ? <p className="text-xs font-semibold text-emerald-700">{success}</p> : null}

        <button
          type="submit"
          disabled={sending || !subject.trim() || !message.trim()}
          className={`${Z_BTN_PRIMARY} inline-flex items-center gap-2`}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {recipientTarget === 'both' ? 'Send to both teachers' : 'Send to teacher'}
        </button>
      </form>

      {loading ? (
        <div className="mt-4 flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : messages.length ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Previous messages ({messages.length})
          </p>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {messages.map((m) => {
              const badge = statusBadge(m.status);
              return (
                <li key={m._id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-800">{m.subject}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </div>
                  {m.recipientLabel ? (
                    <p className="mt-1 font-semibold text-[#1e56e3]">To: {m.recipientLabel}</p>
                  ) : null}
                  <p className="mt-1 text-slate-500">
                    {categoryLabel(m.category)} · {new Date(m.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{m.message}</p>
                  {m.teacherReply ? (
                    <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/80 px-2 py-2 text-emerald-900">
                      <p className="font-bold text-[10px] uppercase text-emerald-700">Teacher reply</p>
                      <p className="mt-1 whitespace-pre-wrap">{m.teacherReply}</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export { categoryLabel, statusBadge, CATEGORY_OPTIONS };
