import { Link } from 'react-router-dom';
import { Github, Linkedin, Rocket, Twitter } from 'lucide-react';
import { BRAND } from '../ui/brandTheme';

const PublicSiteFooter = () => (
    <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-1">
                <div className="flex items-center gap-2 mb-4">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: BRAND.primary }}
                    >
                        <Rocket className="h-5 w-5" />
                    </div>
                    <span className="text-xl font-black text-slate-900">ScholarVerify</span>
                </div>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                    Academic project verification with AI similarity checks, teacher review, and secure previews.
                </p>
            </div>
            <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Platform</p>
                <ul className="space-y-2 text-sm font-semibold text-slate-600">
                    <li><Link to="/" className="hover:text-[#2a3fa4]">System overview</Link></li>
                    <li><Link to="/about" className="hover:text-[#2a3fa4]">Platform guide</Link></li>
                    <li><Link to="/gallery" className="hover:text-[#2a3fa4]">Verified projects</Link></li>
                    <li><Link to="/login" className="hover:text-[#2a3fa4]">Sign in</Link></li>
                </ul>
            </div>
            <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">For students</p>
                <ul className="space-y-2 text-sm font-semibold text-slate-600">
                    <li>Proposal & project workflow</li>
                    <li>Requirement pre-checks</li>
                    <li>Teacher feedback timeline</li>
                </ul>
            </div>
            <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">For faculty</p>
                <ul className="space-y-2 text-sm font-semibold text-slate-600">
                    <li>Assignment & group management</li>
                    <li>Collaborative dual-teacher projects</li>
                    <li>Docker live previews</li>
                </ul>
            </div>
        </div>
        <div className="border-t border-slate-100 py-6 px-4 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-[1400px] mx-auto">
            <p className="text-xs font-semibold text-slate-400">
                &copy; {new Date().getFullYear()} ScholarVerify Academic Systems. All rights reserved.
            </p>
            <div className="flex items-center gap-3 text-slate-400">
                <Twitter className="h-4 w-4" />
                <Linkedin className="h-4 w-4" />
                <Github className="h-4 w-4" />
            </div>
        </div>
    </footer>
);

export default PublicSiteFooter;
