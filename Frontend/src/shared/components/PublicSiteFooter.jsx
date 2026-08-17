import { Link } from 'react-router-dom';
import { Github, Linkedin, Twitter } from 'lucide-react';
import { PRODUCT_TAGLINE, PROJECT_LEGAL_NAME } from '../ui/brandTheme';
import ProjectVerifyLogo from './ProjectVerifyLogo';

const PublicSiteFooter = () => (
    <footer className="bg-slate-950 text-white [font-family:var(--sv-font-sans)]">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
            <div className="md:col-span-1">
                <Link to="/" className="mb-4 inline-block">
                    <ProjectVerifyLogo size="lg" showMark={false} onDark tagline={PRODUCT_TAGLINE} />
                </Link>
                <p className="text-sm font-medium leading-relaxed text-slate-400">
                    Automated Academic Project Verification Using Machine Learning with Integrated Docker-Based
                    Sandbox Preview
                </p>
            </div>
            <div>
                <p className="mb-4 text-xs font-extrabold uppercase tracking-widest text-white">Platform</p>
                <ul className="space-y-2.5 text-sm font-semibold text-slate-400">
                    <li><Link to="/" className="hover:text-white">Home</Link></li>
                    <li><Link to="/guide" className="hover:text-white">Guide</Link></li>
                    <li><Link to="/about" className="hover:text-white">About</Link></li>
                    <li><Link to="/gallery" className="hover:text-white">Verified Projects</Link></li>
                    <li><Link to="/login" className="hover:text-white">Sign in</Link></li>
                </ul>
            </div>
            <div>
                <p className="mb-4 text-xs font-extrabold uppercase tracking-widest text-white">For students</p>
                <ul className="space-y-2.5 text-sm font-semibold text-slate-400">
                    <li>Proposal & project workflow</li>
                    <li>Requirement pre-checks</li>
                    <li>Teacher feedback timeline</li>
                </ul>
            </div>
            <div>
                <p className="mb-4 text-xs font-extrabold uppercase tracking-widest text-white">For faculty</p>
                <ul className="space-y-2.5 text-sm font-semibold text-slate-400">
                    <li>Assignment & group management</li>
                    <li>Collaborative dual-teacher projects</li>
                    <li>Docker live previews</li>
                </ul>
            </div>
        </div>

        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 border-t border-white/10 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
            <p className="text-xs font-semibold text-slate-500">
                &copy; {new Date().getFullYear()} {PROJECT_LEGAL_NAME}. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-slate-400">
                <Twitter className="h-4 w-4" aria-hidden />
                <Linkedin className="h-4 w-4" aria-hidden />
                <Github className="h-4 w-4" aria-hidden />
            </div>
        </div>
    </footer>
);

export default PublicSiteFooter;
