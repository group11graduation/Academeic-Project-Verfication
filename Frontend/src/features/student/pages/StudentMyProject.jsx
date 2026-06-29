import StudentHomeDashboard from '../../../shared/components/StudentHomeDashboard';
import { Z_SHELL, Z_SHELL_INNER } from '../../../shared/ui/zendentaLayout';

/** Student home — same dashboard as authenticated landing (top-nav layout). */
const StudentMyProject = () => (
    <div className={Z_SHELL}>
        <div className={Z_SHELL_INNER}>
            <StudentHomeDashboard />
        </div>
    </div>
);

export default StudentMyProject;
