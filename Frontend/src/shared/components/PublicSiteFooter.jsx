import { Link } from 'react-router-dom';
import { Github, Linkedin, Twitter } from 'lucide-react';
import { PRODUCT_TAGLINE, PROJECT_LEGAL_NAME, BRAND } from '../ui/brandTheme';
import ProjectVerifyLogo from './ProjectVerifyLogo';

/** Dark brand navy — close to primary, still deep/dark */
const FOOTER_BG = `linear-gradient(165deg, ${BRAND.primaryDeep} 0%, #121a3d 48%, #0d142e 100%)`;

const PublicSiteFooter = () => (
    <footer
        className="text-white [font-family:var(--sv-font-sans)]"
        style={{ background: FOOTER_BG }}
    >
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
            <div className="md:col-span-1">
                <Link to="/" className="mb-4 inline-block">
                    <ProjectVerifyLogo size="lg" showMark={false} onDark tagline={PRODUCT_TAGLINE} />
                </Link>
                <p className="text-sm font-medium leading-relaxed text-blue-100/70">
                    Automated Academic Project Verification Using Machine Learning with Integrated Docker-Based
                    Sandbox Preview
                </p>
            </div>
            <div>
                <p className="mb-4 text-xs font-extrabold uppercase tracking-widest text-white">Platform</p>
                <ul className="space-y-2.5 text-sm font-semibold text-blue-100/65">
                    <li><Link to="/" className="transition hover:text-white">Home</Link></li>
                    <li><Link to="/guide" className="transition hover:text-white">Guide</Link></li>
                    <li><Link to="/about" className="transition hover:text-white">About</Link></li>
                    <li><Link to="/gallery" className="transition hover:text-white">Verified Projects</Link></li>
                    <li><Link to="/login" className="transition hover:text-white">Sign in</Link></li>
                </ul>
            </div>
            <div>
                <p className="mb-4 text-xs font-extrabold uppercase tracking-widest text-white">For students</p>
                <ul className="space-y-2.5 text-sm font-semibold text-blue-100/65">
                    <li>Proposal & project workflow</li>
                    <li>Requirement pre-checks</li>
                    <li>Teacher feedback timeline</li>
                </ul>
            </div>
            <div>
                <p className="mb-4 text-xs font-extrabold uppercase tracking-widest text-white">For faculty</p>
                <ul className="space-y-2.5 text-sm font-semibold text-blue-100/65">
                    <li>Assignment & group management</li>
                    <li>Collaborative dual-teacher projects</li>
                    <li>Docker live previews</li>
                </ul>
            </div>
        </div>

        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 border-t border-white/10 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
            <p className="text-xs font-semibold text-blue-200/45">
                &copy; {new Date().getFullYear()} {PROJECT_LEGAL_NAME}. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-blue-100/55">
                <Twitter className="h-4 w-4 transition hover:text-white" aria-hidden />
                <Linkedin className="h-4 w-4 transition hover:text-white" aria-hidden />
                <Github className="h-4 w-4 transition hover:text-white" aria-hidden />
            </div>
        </div>
    </footer>
);

export default PublicSiteFooter;
