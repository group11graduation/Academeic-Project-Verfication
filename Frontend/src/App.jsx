import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppRoutes from './app/routes/AppRoutes';
import { AuthProvider } from './context/authContext';
import { DialogProvider } from './context/dialogContext';
import { ThemeProvider } from './context/themeContext';

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <DialogProvider>
                    <Router>
                        <AppRoutes />
                    </Router>
                </DialogProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
