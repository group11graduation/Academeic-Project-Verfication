import { Link } from 'react-router-dom';
import { Github, Linkedin, Twitter } from 'lucide-react';
import { PROJECT_LEGAL_NAME } from '../ui/brandTheme';
import ProjectVerifyLogo from './ProjectVerifyLogo';

const PublicSiteFooter = () => (
    <footer className="border-t border-slate-200 bg-white dark:border-white/10 dark:bg-[#0b1220]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-1">
                <Link to="/" className="inline-block mb-4">
                    <ProjectVerifyLogo size="lg" />
                </Link>
                <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    Academic project verification with AI similarity checks, teacher review, and secure previews.
                </p>
            </div>
            <div>
                <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Platform</p>
                <ul className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    <li><Link to="/" className="hover:text-[#2a3fa4] dark:hover:text-blue-300">System overview</Link></li>
                    <li><Link to="/about" className="hover:text-[#2a3fa4] dark:hover:text-blue-300">Platform guide</Link></li>
                    <li><Link to="/gallery" className="hover:text-[#2a3fa4] dark:hover:text-blue-300">Verified projects</Link></li>
                    <li><Link to="/login" className="hover:text-[#2a3fa4] dark:hover:text-blue-300">Sign in</Link></li>
                </ul>
            </div>
            <div>
                <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">For students</p>
                <ul className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    <li>Proposal & project workflow</li>
                    <li>Requirement pre-checks</li>
                    <li>Teacher feedback timeline</li>
                </ul>
            </div>
            <div>
                <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">For faculty</p>
                <ul className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    <li>Assignment & group management</li>
                    <li>Collaborative dual-teacher projects</li>
                    <li>Docker live previews</li>
                </ul>
            </div>
        </div>
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 border-t border-slate-100 px-4 py-6 dark:border-white/10 sm:flex-row">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                &copy; {new Date().getFullYear()} {PROJECT_LEGAL_NAME}. All rights reserved.
            </p>
            <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                <Twitter className="h-4 w-4" />
                <Linkedin className="h-4 w-4" />
                <Github className="h-4 w-4" />
            </div>
        </div>
    </footer>
);

export default PublicSiteFooter;
