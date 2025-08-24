import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Globe } from 'lucide-react';
import { getAvailableLanguages } from '../i18n';
import { Flag } from './ui/Flag';
import type { FlagCode } from '../assets/flags';

const languages = getAvailableLanguages();

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white rounded-md"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Select language"
      >
        <Globe className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <div className="flex items-center gap-2 w-[100px]">
          <Flag code={currentLanguage.code as FlagCode} size="sm" />
          <span className="text-sm" dir={currentLanguage.dir}>{currentLanguage.name}</span>
        </div>
        <ChevronDown 
          className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} 
          aria-hidden="true" 
        />
      </button>

      {isOpen && (
        <div 
          className="absolute md:right-0 left-0 md:left-auto mt-2 w-[160px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-[calc(100vh-100px)] overflow-y-auto"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="language-menu"
        >
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => changeLanguage(language.code)}
              className="w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700 transition-colors"
              role="menuitem"
            >
              <div 
                className={`flex items-center gap-2 ${language.dir === 'rtl' ? 'justify-end' : 'justify-start'}`} 
                dir={language.dir}
              >
                <Flag code={language.code as FlagCode} size="sm" />
                <span>{language.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}; 