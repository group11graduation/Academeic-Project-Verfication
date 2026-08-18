import React from 'react';
import { ShellSearchProvider } from '../../../context/shellSearchContext';
import StudentHeader from '../components/StudentHeader';

/** Public student-facing pages with a shared header search bar. */
const StudentPublicShell = ({ children, forcePublic = false }) => (
    <ShellSearchProvider>
        <div className="min-h-[100dvh] w-full max-w-full overflow-x-clip antialiased [font-family:var(--sv-font-sans)]">
            <StudentHeader forcePublic={forcePublic} />
            <div className="w-full max-w-full min-w-0 overflow-x-clip">{children}</div>
        </div>
    </ShellSearchProvider>
);

export default StudentPublicShell;
