import { Link } from 'react-router-dom';
import { Github, Linkedin, Twitter } from 'lucide-react';
import { PRODUCT_TAGLINE, PROJECT_LEGAL_NAME } from '../ui/brandTheme';
import ProjectVerifyLogo from './ProjectVerifyLogo';

const PublicSiteFooter = () => (
    <footer className="border-t border-[var(--sv-border)] bg-[var(--sv-card)] dark:border-white/10 dark:bg-[#0b1220]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-1">
                <Link to="/" className="mb-4 inline-block">
                    <ProjectVerifyLogo size="lg" showMark={false} tagline={PRODUCT_TAGLINE} />
                </Link>
                <p className="text-sm font-medium leading-relaxed text-[var(--sv-muted)] dark:text-[var(--sv-muted)]">
                    Automated Academic Project Verification Using Machine Learning with Integrated Docker-Based
                    Sandbox Preview
                </p>
            </div>
            <div>
                <p className="mb-4 text-xs font-black uppercase tracking-widest text-[var(--sv-muted)] dark:text-[var(--sv-muted)]">Platform</p>
                <ul className="space-y-2 text-sm font-semibold text-[var(--sv-muted)] dark:text-slate-300">
                    <li><Link to="/" className="hover:text-[#2a3fa4] dark:hover:text-blue-300">Home</Link></li>
                    <li><Link to="/guide" className="hover:text-[#2a3fa4] dark:hover:text-blue-300">Guide</Link></li>
                    <li><Link to="/about" className="hover:text-[#2a3fa4] dark:hover:text-blue-300">About</Link></li>
                    <li><Link to="/gallery" className="hover:text-[#2a3fa4] dark:hover:text-blue-300">Verified Projects</Link></li>
                    <li><Link to="/login" className="hover:text-[#2a3fa4] dark:hover:text-blue-300">Sign in</Link></li>
                </ul>
            </div>
            <div>
                <p className="mb-4 text-xs font-black uppercase tracking-widest text-[var(--sv-muted)] dark:text-[var(--sv-muted)]">For students</p>
                <ul className="space-y-2 text-sm font-semibold text-[var(--sv-muted)] dark:text-slate-300">
                    <li>Proposal & project workflow</li>
                    <li>Requirement pre-checks</li>
                    <li>Teacher feedback timeline</li>
                </ul>
            </div>
            <div>
                <p className="mb-4 text-xs font-black uppercase tracking-widest text-[var(--sv-muted)] dark:text-[var(--sv-muted)]">For faculty</p>
                <ul className="space-y-2 text-sm font-semibold text-[var(--sv-muted)] dark:text-slate-300">
                    <li>Assignment & group management</li>
                    <li>Collaborative dual-teacher projects</li>
                    <li>Docker live previews</li>
                </ul>
            </div>
        </div>
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 border-t border-[var(--sv-border)] px-4 py-6 dark:border-white/10 sm:flex-row">
            <p className="text-xs font-semibold text-[var(--sv-muted)] dark:text-[var(--sv-muted)]">
                &copy; {new Date().getFullYear()} {PROJECT_LEGAL_NAME}. All rights reserved.
            </p>
            <div className="flex items-center gap-3 text-[var(--sv-muted)] dark:text-[var(--sv-muted)]">
                <Twitter className="h-4 w-4" />
                <Linkedin className="h-4 w-4" />
                <Github className="h-4 w-4" />
            </div>
        </div>
    </footer>
);

export default PublicSiteFooter;
