import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Copy, Download, ChevronRight, Printer, FileText } from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { getApiOrigin } from '../../../lib/api';
import { normsFromAnyDocument } from '../../../lib/ipynbDocument';
import ExtractedSubmissionView from '../components/ExtractedSubmissionView';
import { Z_PAGE, Z_INNER, Z_CARD, Z_LINK } from '../../../shared/ui/zendentaLayout';

function DetailRow({ label, value }) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-3 gap-y-1 border-b border-slate-50 py-3 last:border-0 sm:grid-cols-[140px_1fr]">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
            <span className="text-sm font-semibold text-slate-900 break-words">{value ?? '—'}</span>
        </div>
    );
}

function DocumentPane({ title, subtitle, badge, filename, text, highlightNorms, onCopy, showCopy }) {
    return (
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#1e56e3]">{title}</p>
                    <p className="mt-0.5 truncate text-base font-bold text-slate-900">{subtitle}</p>
                    {badge ? (
                        <p className="mt-1 truncate text-xs font-semibold text-[#1e56e3]" title={badge}>
                            {badge}
                        </p>
                    ) : null}
                </div>
                {showCopy && text ? (
                    <button
                        type="button"
                        onClick={onCopy}
                        className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                        title="Copy extracted text"
                    >
                        <Copy className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
            <div className="max-h-[min(65vh,640px)] flex-1 overflow-y-auto px-5 py-4">
                <ExtractedSubmissionView text={text} filename={filename} highlightNorms={highlightNorms} />
            </div>
        </div>
    );
}

const NormalAssignmentStudentDetail = () => {
    const { id: assignmentId, studentUserId } = useParams();
    const navigate = useNavigate();
    const apiOrigin = getApiOrigin();
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('document');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const res = await teacherService.getNormalSubmissionStudentDetail(assignmentId, studentUserId);
                if (cancelled) return;
                if (res.success) setDetail(res.data);
                else setError(res.message || 'Failed to load.');
            } catch (e) {
                if (!cancelled) setError(e.response?.data?.message || 'Failed to load student.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [assignmentId, studentUserId]);

    const leftText = detail?.submission?.extractedText || '';
    const rightText = detail?.matchedPeer?.extractedText || '';

    const peerHighlightNorms = useMemo(() => normsFromAnyDocument(rightText), [rightText]);
    const selfHighlightNorms = useMemo(() => normsFromAnyDocument(leftText), [leftText]);

    const similarityPct =
        detail?.submission?.plagiarismScore != null
            ? Math.round(Number(detail.submission.plagiarismScore) * 100)
            : null;

    const hasPeerCompare = Boolean(detail?.matchedPeer && rightText);

    useEffect(() => {
        if (tab === 'compare' && !hasPeerCompare) setTab('document');
    }, [tab, hasPeerCompare]);

    const copyLeft = async () => {
        if (!leftText) return;
        try {
            await navigator.clipboard.writeText(leftText);
        } catch {
            /* ignore */
        }
    };

    if (loading) {
        return (
            <div className={`${Z_PAGE} flex min-h-[50vh] flex-1 items-center justify-center`}>
                <Loader2 className="h-10 w-10 animate-spin text-[#1e56e3]" />
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className={Z_PAGE}>
                <div className={Z_INNER}>
                    <nav className="mb-4 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-slate-500">
                        <Link to="/teacher/assignments" className={Z_LINK}>
                            Assignments
                        </Link>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        <button type="button" onClick={() => navigate(-1)} className={Z_LINK}>
                            Students
                        </button>
                    </nav>
                    <div className={`${Z_CARD} border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800`}>
                        {error || 'Not found.'}
                    </div>
                </div>
            </div>
        );
    }

    const { assignment, student, submission, matchedPeer } = detail;
    const submitted = Boolean(submission);
    const downloadUrl = submission?.downloadPath ? `${apiOrigin}${submission.downloadPath}` : null;
    const assignmentTitle = assignment?.title || 'Assignment';
    const subj = assignment?.subject;
    const subjectLine =
        subj && typeof subj === 'object' && (subj.name || subj.code)
            ? `${subj.name || ''}${subj.code ? ` (${subj.code})` : ''}`.trim() || '—'
            : '—';

    const uploadDate = submission?.createdAt
        ? new Date(submission.createdAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          })
        : '—';

    const fileSizeLabel =
        submission?.sizeBytes != null
            ? submission.sizeBytes >= 1_048_576
                ? `${(submission.sizeBytes / 1_048_576).toFixed(1)} MB`
                : `${Math.max(1, Math.round(submission.sizeBytes / 1024))} KB`
            : '—';

    return (
        <div className={Z_PAGE}>
            <div className={Z_INNER}>
            <nav className="mb-4 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-slate-500">
                <Link to="/teacher/assignments" className={Z_LINK}>
                    Assignments
                </Link>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <Link
                    to={`/teacher/assignments/${assignmentId}/normal-students`}
                    className={`${Z_LINK} max-w-[200px] truncate md:max-w-xs`}
                    title={assignmentTitle}
                >
                    {assignmentTitle}
                </Link>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="max-w-[180px] truncate text-slate-800 md:max-w-md" title={student?.name || ''}>
                    {student?.name || 'Student'}
                </span>
            </nav>

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={() => navigate(`/teacher/assignments/${assignmentId}/normal-students`)}
                    className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-800"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to student list
                </button>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        <Printer className="h-4 w-4" />
                        Print
                    </button>
                    {downloadUrl ? (
                        <a
                            href={downloadUrl}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-[#1e56e3] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1a4dcc]"
                        >
                            <Download className="h-4 w-4" />
                            Download file
                        </a>
                    ) : null}
                </div>
            </div>

            {/* Top row: profile + details + notes */}
            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className={`${Z_CARD} p-5`}>
                    <div className="flex flex-col items-center text-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#1e56e3] to-[#3b74ff] text-2xl font-bold text-white shadow-md">
                            {(student.name || student.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <h1 className="mt-4 text-lg font-bold text-slate-900">{student.name || 'Student'}</h1>
                        <p className="mt-1 max-w-full break-all text-sm text-slate-500">{student.email || '—'}</p>
                        <div className="mt-5 grid w-full grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
                            <div className="rounded-lg bg-slate-50 py-2 text-center">
                                <p className="text-xl font-bold text-slate-900">{submitted ? 1 : 0}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">File uploaded</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 py-2 text-center">
                                <p className="text-xl font-bold text-slate-900">{similarityPct != null ? `${similarityPct}%` : '—'}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Vs closest peer</p>
                            </div>
                        </div>
                        {downloadUrl ? (
                            <a
                                href={downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-5 w-full rounded-xl bg-[#1e56e3] py-2.5 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#1a4dcc]"
                            >
                                Open submission file
                            </a>
                        ) : (
                            <p className="mt-5 w-full rounded-xl border border-dashed border-slate-200 py-2.5 text-center text-xs font-semibold text-slate-400">
                                No file to open
                            </p>
                        )}
                    </div>
                </div>

                <div className={`${Z_CARD} p-5`}>
                    <h2 className="mb-1 text-sm font-bold text-slate-900">Student information</h2>
                    <p className="mb-4 text-xs text-slate-500">Assignment and enrollment details.</p>
                    <div className="divide-y divide-slate-50">
                        <DetailRow label="Assignment" value={assignmentTitle} />
                        <DetailRow label="Subject" value={subjectLine} />
                        <DetailRow label="Class code" value={student.classCode || '—'} />
                        <DetailRow label="Student ID" value={student.studentId || '—'} />
                        <DetailRow label="Submission status" value={submitted ? 'Submitted' : 'Not submitted'} />
                        <DetailRow label="Uploaded" value={uploadDate} />
                        <DetailRow label="Original filename" value={submission?.originalFilename || '—'} />
                        <DetailRow label="File size" value={fileSizeLabel} />
                        <DetailRow
                            label="Similarity"
                            value={
                                similarityPct != null
                                    ? `${similarityPct}%${submission?.plagiarismFlag ? ' (flagged high)' : ''}`
                                    : '—'
                            }
                        />
                        {matchedPeer?.name || matchedPeer?.email ? (
                            <DetailRow
                                label="Closest peer"
                                value={
                                    [matchedPeer.name, matchedPeer.email].filter(Boolean).join(' · ') ||
                                    matchedPeer.originalFilename ||
                                    '—'
                                }
                            />
                        ) : null}
                    </div>
                </div>

                <div className={`${Z_CARD} flex flex-col p-5`}>
                    <div className="mb-3 flex items-start justify-between gap-2">
                        <h2 className="text-sm font-bold text-slate-900">Review notes</h2>
                        <span className="text-xs font-semibold text-[#1e56e3]">Read-only</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
                        Quick reference for plagiarism checks on this assignment. Judgment stays with you—similarity can
                        reflect shared templates or legitimate overlap.
                    </p>
                    <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                        <li className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1e56e3]" />
                            <span>
                                {submitted
                                    ? `Latest upload: ${submission?.originalFilename || 'file'} (${uploadDate}).`
                                    : 'No upload recorded for this student on this assignment.'}
                            </span>
                        </li>
                        {similarityPct != null ? (
                            <li className="flex gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1e56e3]" />
                                <span>
                                    Automated similarity vs the closest other submission on this same assignment:{' '}
                                    <strong>{similarityPct}%</strong>
                                    {submission?.plagiarismFlag ? (
                                        <span className="font-bold text-rose-600"> — marked high (≥85%).</span>
                                    ) : (
                                        '.'
                                    )}
                                </span>
                            </li>
                        ) : null}
                        {matchedPeer?.name ? (
                            <li className="flex gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1e56e3]" />
                                <span>
                                    Closest text/code match stored against: <strong>{matchedPeer.name}</strong>
                                    {matchedPeer.originalFilename ? ` (${matchedPeer.originalFilename})` : ''}.
                                </span>
                            </li>
                        ) : null}
                        {submission?.plagiarismMethod ? (
                            <li className="flex gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                <span className="text-xs text-slate-500">Method: {submission.plagiarismMethod}</span>
                            </li>
                        ) : null}
                    </ul>
                    <div className="mt-4 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-400">
                        Normal assignment · plagiarism compares only to other students on this assignment.
                    </div>
                </div>
            </div>

            {/* Bottom: tabs + files */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-5">
                <div className="lg:col-span-3">
                    <div className={`${Z_CARD} flex min-h-0 flex-col overflow-hidden lg:min-h-[320px]`}>
                        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-2 pt-2">
                            {[
                                { id: 'document', label: 'Extracted document' },
                                { id: 'activity', label: 'Submission activity' },
                                ...(hasPeerCompare ? [{ id: 'compare', label: 'Peer comparison' }] : []),
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setTab(t.id)}
                                    className={`rounded-t-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition ${
                                        tab === t.id
                                            ? 'border border-b-0 border-slate-200 bg-white text-[#1e56e3]'
                                            : 'border border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <div className="min-h-0 flex-1 bg-white p-4 md:p-5">
                            {tab === 'activity' && (
                                <div className="relative pl-6">
                                    <div className="absolute bottom-2 left-[11px] top-2 w-0.5 bg-[#1e56e3]/25" />
                                    <ul className="space-y-6">
                                        <li className="relative">
                                            <span className="absolute -left-1 top-1.5 flex h-3 w-3 -translate-x-[1.125rem] items-center justify-center rounded-full border-2 border-white bg-[#1e56e3] shadow" />
                                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                                Record
                                            </p>
                                            <p className="mt-1 font-bold text-slate-900">
                                                {submitted ? 'Submission received' : 'Awaiting upload'}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-600">
                                                {submitted
                                                    ? `File “${submission.originalFilename || 'upload'}” recorded at ${uploadDate}.`
                                                    : 'Student has not submitted a file for this assignment yet.'}
                                            </p>
                                        </li>
                                        {submitted && similarityPct != null ? (
                                            <li className="relative">
                                                <span className="absolute -left-1 top-1.5 flex h-3 w-3 -translate-x-[1.125rem] items-center justify-center rounded-full border-2 border-white bg-[#1e56e3] shadow" />
                                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                                    Similarity
                                                </p>
                                                <p className="mt-1 font-bold text-slate-900">
                                                    Peer comparison: {similarityPct}%
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    {submission.plagiarismFlag
                                                        ? 'Flagged as high similarity (≥85%) versus another submission on this assignment.'
                                                        : 'Below the high-similarity threshold; still review contextually.'}
                                                </p>
                                            </li>
                                        ) : null}
                                    </ul>
                                </div>
                            )}
                            {tab === 'document' && (
                                <>
                                    {!submitted ? (
                                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-16 text-center text-sm font-semibold text-slate-500">
                                            No document to display — student has not submitted a file.
                                        </div>
                                    ) : (
                                        <DocumentPane
                                            title="Extracted text"
                                            subtitle={student.name || 'Student'}
                                            badge={submission.originalFilename || undefined}
                                            filename={submission.originalFilename || undefined}
                                            text={leftText}
                                            highlightNorms={null}
                                            onCopy={copyLeft}
                                            showCopy
                                        />
                                    )}
                                </>
                            )}
                            {tab === 'compare' && hasPeerCompare && (
                                <div className="grid gap-4 xl:grid-cols-2">
                                    <DocumentPane
                                        title="This student"
                                        subtitle={student.name || student.email || 'Current'}
                                        badge={submission.originalFilename || undefined}
                                        filename={submission.originalFilename || undefined}
                                        text={leftText}
                                        highlightNorms={peerHighlightNorms}
                                        onCopy={copyLeft}
                                        showCopy
                                    />
                                    <DocumentPane
                                        title="Closest peer"
                                        subtitle={matchedPeer.name || matchedPeer.email || 'Matched'}
                                        badge={
                                            similarityPct != null
                                                ? `~${similarityPct}% · ${matchedPeer.originalFilename || ''}`
                                                : matchedPeer.originalFilename || undefined
                                        }
                                        filename={matchedPeer.originalFilename || undefined}
                                        text={rightText}
                                        highlightNorms={selfHighlightNorms}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className={`${Z_CARD} p-5`}>
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <h2 className="text-sm font-bold text-slate-900">Files / documents</h2>
                            <span className="text-xs font-semibold text-slate-400">{submitted ? '1 item' : '0 items'}</span>
                        </div>
                        {submitted && submission?.originalFilename ? (
                            <ul className="space-y-2">
                                <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
                                        <FileText className="h-5 w-5 text-[#1e56e3]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-slate-900">{submission.originalFilename}</p>
                                        <p className="text-xs font-medium text-slate-500">{fileSizeLabel}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        {downloadUrl ? (
                                            <a
                                                href={downloadUrl}
                                                download
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-[#1e56e3]"
                                                title="Download"
                                            >
                                                <Download className="h-4 w-4" />
                                            </a>
                                        ) : null}
                                    </div>
                                </li>
                            </ul>
                        ) : (
                            <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm font-semibold text-slate-400">
                                No files uploaded yet.
                            </p>
                        )}
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default NormalAssignmentStudentDetail;
