import { createContext, useContext, useEffect, useState } from 'react';

const CompactModeContext = createContext();

export function CompactModeProvider({ children }) {
  const [isCompact, setIsCompact] = useState(() => {
    // Get compact mode preference from localStorage or default to false
    const savedCompactMode = localStorage.getItem('compactMode');
    return savedCompactMode ? JSON.parse(savedCompactMode) : false;
  });

  useEffect(() => {
    // Apply compact class to document body
    if (isCompact) {
      document.body.classList.add('compact-mode');
    } else {
      document.body.classList.remove('compact-mode');
    }
  }, [isCompact]);

  const toggleCompactMode = () => {
    const newCompactMode = !isCompact;
    setIsCompact(newCompactMode);
    localStorage.setItem('compactMode', JSON.stringify(newCompactMode));
  };

  const setCompactMode = (compact) => {
    setIsCompact(compact);
    localStorage.setItem('compactMode', JSON.stringify(compact));
  };

  const value = {
    isCompact,
    toggleCompactMode,
    setCompactMode
  };

  return (
    <CompactModeContext.Provider value={value}>
      {children}
    </CompactModeContext.Provider>
  );
}

export function useCompactMode() {
  const context = useContext(CompactModeContext);
  if (!context) {
    throw new Error('useCompactMode must be used within a CompactModeProvider');
  }
  return context;
}