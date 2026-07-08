import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Get user-specific theme key - uses id, _id, or email as unique identifier
const getThemeKey = (): string => {
  try {
    const userString = localStorage.getItem('user');
    if (userString) {
      const user = JSON.parse(userString);
      // Use id, _id, or email - whichever is available (backend returns 'id')
      const userId = user.id || user._id || user.email;
      if (userId) {
        return `theme_${userId}`;
      }
    }
  } catch (e) {
    console.error('Error getting user theme key:', e);
  }
  return 'theme_default';
};

// Get current user ID for comparison
const getCurrentUserId = (): string | null => {
  try {
    const userString = localStorage.getItem('user');
    if (userString) {
      const user = JSON.parse(userString);
      return user.id || user._id || user.email || null;
    }
  } catch (e) {
    console.error('Error getting user ID:', e);
  }
  return null;
};

// Get initial actual theme synchronously
const getInitialActualTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return theme;
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Track current user ID to detect user changes
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => getCurrentUserId());
  
  // Track if theme is being changed by user (to prevent polling interference)
  const isChangingThemeRef = React.useRef(false);

  // Initialize theme based on current user
  const initializeTheme = (): Theme => {
    const themeKey = getThemeKey();
    const stored = localStorage.getItem(themeKey) as Theme;
    return stored || 'system';
  };

  const [theme, setTheme] = useState<Theme>(initializeTheme);

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(() => {
    return getInitialActualTheme(initializeTheme());
  });
  
  // Custom setTheme that immediately applies to DOM and prevents polling interference
  const setThemeWithImmediateApply = React.useCallback((newTheme: Theme) => {
    isChangingThemeRef.current = true;
    
    // Update state
    setTheme(newTheme);
    
    // Immediately apply to DOM (synchronously, before React re-renders)
    const root = window.document.documentElement;
    const newActualTheme = getInitialActualTheme(newTheme);
    root.classList.remove('light', 'dark');
    root.classList.add(newActualTheme);
    setActualTheme(newActualTheme);
    
    // Save to localStorage
    const themeKey = getThemeKey();
    if (themeKey !== 'theme_default' || getCurrentUserId()) {
      localStorage.setItem(themeKey, newTheme);
    }
    
    // Reset flag after a short delay to allow state to settle
    setTimeout(() => {
      isChangingThemeRef.current = false;
    }, 100);
  }, []);

  // Apply theme immediately to DOM (useLayoutEffect runs synchronously before paint)
  useLayoutEffect(() => {
    // Skip if theme is being changed by user (to prevent flickering)
    if (isChangingThemeRef.current) {
      return;
    }
    
    const root = window.document.documentElement;
    
    const updateTheme = () => {
      let newTheme: 'light' | 'dark';
      
      if (theme === 'system') {
        newTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        newTheme = theme;
      }
      
      // Only update state if theme actually changed
      if (actualTheme !== newTheme) {
      setActualTheme(newTheme);
      }
      
      // Always ensure the class is applied immediately (prevents flash on route changes)
      root.classList.remove('light', 'dark');
      root.classList.add(newTheme);
    };

    updateTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        if (!isChangingThemeRef.current) {
          updateTheme();
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, actualTheme]);

  // Keep theme class persistent during route changes (runs after every render)
  useLayoutEffect(() => {
    // Skip if theme is being changed by user
    if (isChangingThemeRef.current) {
      return;
    }
    
    const root = window.document.documentElement;
    const currentTheme = actualTheme;
    
    // Ensure theme class is always present (catches any route changes or re-renders)
    if (!root.classList.contains(currentTheme)) {
      root.classList.remove('light', 'dark');
      root.classList.add(currentTheme);
    }
  });

  // Monitor user changes and update theme accordingly
  useEffect(() => {
    const checkUserChange = () => {
      // Skip if theme is currently being changed by user
      if (isChangingThemeRef.current) {
        return;
      }
      
      const newUserId = getCurrentUserId();
      
      // If user changed (different ID or logged out)
      if (newUserId !== currentUserId) {
        // Update tracked user ID
        setCurrentUserId(newUserId);
        
        // Load the new user's theme preference
        const themeKey = getThemeKey();
        const stored = localStorage.getItem(themeKey) as Theme;
        const newTheme = stored || 'system';
        
        // Update theme immediately
        setTheme(newTheme);
        
        // Also immediately apply to DOM
        const root = window.document.documentElement;
        const newActualTheme = getInitialActualTheme(newTheme);
        root.classList.remove('light', 'dark');
        root.classList.add(newActualTheme);
        setActualTheme(newActualTheme);
      } else {
        // Same user - just check if their theme preference changed (but don't interfere if user is changing it)
        if (!isChangingThemeRef.current) {
          const themeKey = getThemeKey();
          const stored = localStorage.getItem(themeKey) as Theme;
          // Only update if it's different AND not currently being changed
          if (stored && stored !== theme) {
            setTheme(stored);
            const root = window.document.documentElement;
            const newActualTheme = getInitialActualTheme(stored);
            root.classList.remove('light', 'dark');
            root.classList.add(newActualTheme);
            setActualTheme(newActualTheme);
          }
        }
      }
    };

    // Check immediately
    checkUserChange();

    // Listen for storage changes (when user logs in/out from another tab or same tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        checkUserChange();
      }
    };

    // Also listen for custom events (for same-tab user changes)
    const handleUserChange = () => {
      checkUserChange();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userChanged', handleUserChange);
    
    // Poll for user changes (check every 5 seconds) - further reduced to avoid interference
    // This is a fallback for cases where events don't fire
    // Only check if not currently changing theme
    const interval = setInterval(() => {
      if (!isChangingThemeRef.current) {
        checkUserChange();
      }
    }, 5000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userChanged', handleUserChange);
      clearInterval(interval);
    };
  }, [currentUserId, theme]);

  // Note: Theme saving is now handled in setThemeWithImmediateApply
  // This effect is kept for backwards compatibility but shouldn't be needed

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeWithImmediateApply, actualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
