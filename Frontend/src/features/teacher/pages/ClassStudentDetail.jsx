import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Loader2,
    Mail,
    GraduationCap,
    Users,
    BookOpen,
    ChevronRight,
    FileCheck,
    AlertCircle,
} from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { getApiOrigin } from '../../../lib/api';

function InfoRow({ label, value }) {
    return (
        <div
            className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between py-3 border-b border-[var(--sv-border)] last:border-0"
        >
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--sv-muted)]">{label}</span>
            <span className="text-sm font-bold text-[var(--sv-text)] break-words text-right sm:text-left">
                {value ?? '-'}
            </span>
        </div>
    );
}

function proposalStatusLabel(status) {
    if (!status) return 'No proposal';
    const map = {
        draft: 'Draft',
        submitted: 'Submitted',
        pending_teacher_approval: 'Pending review',
        teacher_approved: 'Approved',
        teacher_rejected: 'Rejected',
        revision_required: 'Revision required',
        requirements_rejected: 'Requirements rejected',
        requirements_review: 'Requirements - teacher review',
        ai_rejected_same_semester: 'Similarity rejected',
        ai_flagged_previous_semester: 'Flagged (previous term)',
    };
    return map[status] || status.replace(/_/g, ' ');
}

function proposalStatusTone(status) {
    if (!status) return 'bg-[var(--bg-elevated)] text-[var(--sv-muted)] dark:bg-white/5 ';
    if (status === 'teacher_approved') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    if (status === 'pending_teacher_approval' || status === 'submitted' || status === 'requirements_review') {
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
    }
    if (status?.includes('rejected') || status?.includes('flagged')) {
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400';
    }
    return 'bg-blue-500/10 text-[var(--brand-primary)] dark:text-blue-400';
}

const ClassStudentDetail = () => {
    const { id: classRef, studentUserId } = useParams();
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const uploadBase = getApiOrigin();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const res = await teacherService.getClassStudentDetail(classRef, studentUserId);
                if (cancelled) return;
                if (res.success) setDetail(res.data);
                else setError(res.message || 'Failed to load student.');
            } catch (e) {
                if (!cancelled) setError(e.response?.data?.message || 'Failed to load student.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [classRef, studentUserId]);

    if (loading) {
        return (
            <div className="h-[400px] flex items-center justify-center bg-[var(--sv-card)]">
                <Loader2 className="h-10 w-10 text-[var(--brand-primary)] animate-spin" />
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="p-4 sm:p-6 md:p-10 text-center bg-[var(--sv-card)] min-h-screen safe-area-px">
                <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-[var(--sv-text)] mb-2">
                    {error || 'Student not found'}
                </h2>
                <Link
                    to={`/teacher/classes/${classRef}/students`}
                    className="text-[var(--brand-primary)] dark:text-blue-400 font-bold hover:underline"
                >
                    Back to student list
                </Link>
            </div>
        );
    }

    const { class: cls, student, activities } = detail;
    const photoUrl =
        student.photo && student.photo !== 'default-student.jpg'
            ? student.photo.startsWith('http')
                ? student.photo
                : `${uploadBase}/uploads/${student.photo}`
            : null;

    return (
        <div className="min-h-screen bg-[var(--sv-card)]">
            <main className="p-3 sm:p-4 md:p-6 lg:p-10 max-w-[1200px] mx-auto safe-area-px">
                <Link
                    to={`/teacher/classes/${classRef}/students`}
                    className="flex items-center gap-2 text-[var(--sv-muted)] hover:text-[var(--brand-primary)] transition-colors mb-8 group w-fit"
                >
                    <div className="bg-[var(--sv-card)] p-2 rounded-xl border border-[var(--sv-border)] shadow-sm group-hover:border-blue-200">
                        <ArrowLeft className="h-4 w-4" />
                    </div>
                    <span className="text-[12px] font-bold uppercase tracking-widest">Back to students</span>
                </Link>

                <header className="mb-10 flex flex-col md:flex-row gap-6 md:items-start">
                    <div className="h-20 w-20 rounded-[24px] bg-[var(--bg-elevated)] border border-[var(--sv-border)] flex items-center justify-center overflow-hidden shrink-0">
                        {photoUrl ? (
                            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-2xl font-bold text-[var(--sv-muted)]">
                                {(student.name || '?')
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .slice(0, 2)}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--brand-primary)] mb-1">
                            {cls.code} • {student.studentId}
                        </p>
                        <h1 className="text-3xl md:text-4xl font-bold text-[var(--sv-text)] mb-2">
                            {student.name}
                        </h1>
                        <p className="text-[var(--sv-muted)] text-sm font-medium flex items-center gap-2 flex-wrap">
                            <Mail className="h-4 w-4 shrink-0 opacity-60" />
                            {student.email || 'No email on file'}
                        </p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                    <section className="rounded-[28px] border border-[var(--sv-border)] bg-[var(--sv-card)] p-6 md:p-8 shadow-lg">
                        <div className="flex items-center gap-3 mb-6">
                            <GraduationCap className="h-6 w-6 text-[var(--brand-primary)]" />
                            <h2 className="text-lg font-bold text-[var(--sv-text)]">Profile</h2>
                        </div>
                        <InfoRow label="Student ID" value={student.studentId} />
                        <InfoRow label="Class code" value={student.classCode} />
                        <InfoRow label="Program" value={student.program} />
                        <InfoRow label="Faculty" value={student.faculty} />
                        <InfoRow
                            label="GPA"
                            value={student.currentGpa != null ? Number(student.currentGpa).toFixed(2) : null}
                        />
                        <InfoRow
                            label="Score"
                            value={student.currentScore != null ? String(student.currentScore) : null}
                        />
                    </section>

                    <section className="rounded-[28px] border border-[var(--sv-border)] bg-[var(--sv-card)] p-6 md:p-8 shadow-lg">
                        <div className="flex items-center gap-3 mb-6">
                            <Users className="h-6 w-6 text-[var(--brand-primary)]" />
                            <h2 className="text-lg font-bold text-[var(--sv-text)]">Class context</h2>
                        </div>
                        <InfoRow label="Section" value={cls.title} />
                        <InfoRow label="Class code" value={cls.code} />
                        <InfoRow label="Class team" value={student.classTemplateGroup} />
                        <Link
                            to={`/teacher/classes/${classRef}`}
                            className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--brand-primary)] hover:underline"
                        >
                            Class overview <ChevronRight className="h-4 w-4" />
                        </Link>
                    </section>
                </div>

                <section className="rounded-[28px] border border-[var(--sv-border)] bg-[var(--sv-card)] shadow-xl overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-[var(--sv-border)] flex items-center gap-3">
                        <BookOpen className="h-6 w-6 text-[var(--brand-primary)]" />
                        <div>
                            <h2 className="text-xl font-bold text-[var(--sv-text)]">Assignments</h2>
                            <p className="text-sm text-[var(--sv-muted)] mt-1">
                                Proposals and project uploads for this class
                            </p>
                        </div>
                    </div>
                    {activities.length === 0 ? (
                        <p className="p-8 text-center text-[var(--sv-muted)] font-medium">No assignments linked to this class yet.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-white/5">
                            {activities.map((a) => (
                                <li key={a.assignmentId} className="p-6 md:p-8 hover:bg-[var(--sv-card-muted)]/80 dark:hover:bg-white/[0.02] transition-colors">
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-lg font-bold text-[var(--sv-text)] mb-2">
                                                {a.title}
                                            </h3>
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[var(--bg-elevated)] dark:bg-white/5 text-[var(--sv-muted)]">
                                                    {a.submissionMode === 'normal' ? 'Individual' : 'Group'}
                                                </span>
                                                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-blue-500/10 text-[var(--brand-primary)]">
                                                    Team: {a.groupName}
                                                </span>
                                                <span
                                                    className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${proposalStatusTone(a.proposalStatus)}`}
                                                >
                                                    {proposalStatusLabel(a.proposalStatus)}
                                                </span>
                                                {a.projectSubmitted ? (
                                                    <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                                                        <FileCheck className="h-3 w-3" />
                                                        Project v{a.projectVersion}
                                                    </span>
                                                ) : null}
                                            </div>
                                            {a.proposalTitle ? (
                                                <p className="text-sm text-[var(--sv-muted)]">
                                                    Proposal: <span className="font-bold">{a.proposalTitle}</span>
                                                </p>
                                            ) : null}
                                            {a.projectFilename ? (
                                                <p className="text-xs text-[var(--sv-muted)] mt-1">ZIP: {a.projectFilename}</p>
                                            ) : null}
                                        </div>
                                        <div className="flex flex-wrap gap-2 shrink-0">
                                            {a.proposalId && a.submissionMode !== 'normal' ? (
                                                <Link
                                                    to={`/teacher/assignments/${a.assignmentId}/proposals/${a.proposalId}`}
                                                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700"
                                                >
                                                    Review proposal <ChevronRight className="h-3.5 w-3.5" />
                                                </Link>
                                            ) : null}
                                            {a.submissionMode === 'normal' && a.proposalStatus ? (
                                                <Link
                                                    to={`/teacher/assignments/${a.assignmentId}/normal-students/${student.userId}`}
                                                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-[var(--sv-border)] text-[var(--sv-text)] text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--sv-card-muted)] dark:hover:bg-white/5"
                                                >
                                                    Submission <ChevronRight className="h-3.5 w-3.5" />
                                                </Link>
                                            ) : null}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </main>
        </div>
    );
};

export default ClassStudentDetail;
