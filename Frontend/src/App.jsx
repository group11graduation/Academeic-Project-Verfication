import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppRoutes from './app/routes/AppRoutes';
import { AuthProvider } from './context/authContext';

function App() {
    return (
        <AuthProvider>
            <Router>
                <AppRoutes />
            </Router>
        </AuthProvider>
    );
}

export default App;
