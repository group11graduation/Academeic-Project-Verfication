import React from 'react';
import { ShellSearchProvider } from '../../../context/shellSearchContext';
import StudentHeader from '../components/StudentHeader';

/** Public student-facing pages with a shared header search bar. */
const StudentPublicShell = ({ children, forcePublic = false }) => (
    <ShellSearchProvider>
        <StudentHeader forcePublic={forcePublic} />
        {children}
    </ShellSearchProvider>
);

export default StudentPublicShell;
