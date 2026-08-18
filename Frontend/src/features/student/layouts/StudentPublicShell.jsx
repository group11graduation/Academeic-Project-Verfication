import React from 'react';
import { ShellSearchProvider } from '../../../context/shellSearchContext';
import StudentHeader from '../components/StudentHeader';

/** Public student-facing pages with a shared header search bar. */
const StudentPublicShell = ({ children, forcePublic = false }) => (
    <ShellSearchProvider>
        <div className="min-h-screen antialiased [font-family:var(--sv-font-sans)]">
            <StudentHeader forcePublic={forcePublic} />
            {children}
        </div>
    </ShellSearchProvider>
);

export default StudentPublicShell;
