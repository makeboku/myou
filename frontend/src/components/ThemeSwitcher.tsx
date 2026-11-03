import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const THEMES = ['light', 'dark', 'starry'] as const;
type Theme = typeof THEMES[number];

const ThemeSwitcher: React.FC = () => {
  const { t } = useTranslation();
  
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved && THEMES.includes(saved as Theme)) return saved as Theme;
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    THEMES.forEach(t => root.classList.remove(t));
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const idx = THEMES.indexOf(prev);
      return THEMES[(idx + 1) % THEMES.length];
    });
  };

  const iconMap: Record<Theme, string> = {
    light: 'fa-moon',
    dark: 'fa-star',
    starry: 'fa-sun',
  };

  return (
    <button
      onClick={toggleTheme}
      className="w-8 h-8 flex items-center justify-center rounded-md transition-all duration-200 hover:bg-primary/20 hover:text-primary hover:scale-110"
      aria-label={t('settings.toggleTheme', '切换主题')}
      title={t('settings.toggleTheme', '切换主题')}
    >
      <i className={`fas ${iconMap[theme]} text-base`}></i>
    </button>
  );
};

export default ThemeSwitcher;