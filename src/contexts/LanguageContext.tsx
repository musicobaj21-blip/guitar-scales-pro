import React, { createContext, useContext, useState, ReactNode } from 'react';
import { translations } from './translations';

interface LanguageContextType {
  language: 'es' | 'en';
  setLanguage: (lang: 'es' | 'en') => void;
  t: (path: string) => string;
  translateNote: (note: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<'es' | 'en'>(() => {
    try {
      const saved = window.localStorage.getItem('rumie_language');
      if (saved === 'es' || saved === 'en') {
        return saved;
      }
    } catch {
      // Ignore storage access errors in Safari/iOS Private Browsing
    }
    return 'es';
  });

  const setLanguage = (lang: 'es' | 'en') => {
    const validLang: 'es' | 'en' = lang === 'en' ? 'en' : 'es';
    setLanguageState(validLang);
    try {
      window.localStorage.setItem('rumie_language', validLang);
    } catch {
      // Ignore storage write errors in Safari/iOS Private Browsing
    }
  };

  const t = (path: string): string => {
    if (!path || typeof path !== 'string') return '';
    const keys = path.split('.');

    const resolveFromDict = (dict: any): string | undefined => {
      try {
        const val = keys.reduce(
          (obj, key) => (obj && typeof obj === 'object' && obj[key] !== undefined ? obj[key] : undefined),
          dict
        );
        if (typeof val === 'string') return val;
        if (typeof val === 'number' || typeof val === 'boolean') return String(val);
      } catch {
        // Fallback on any unexpected traversal error
      }
      return undefined;
    };

    const currentLangDict = (translations as any)[language] || translations.es;
    const translated = resolveFromDict(currentLangDict);
    if (translated !== undefined) return translated;

    const fallbackEs = resolveFromDict(translations.es);
    if (fallbackEs !== undefined) return fallbackEs;

    const cleanKey = keys[keys.length - 1] || path;
    return String(cleanKey);
  };

  const translateNote = (note: string) => {
    if (language === 'en') return note;
    const noteMap: { [key: string]: string } = {
      'C': 'Do', 'C#': 'Do#', 'Db': 'Reb',
      'D': 'Re', 'D#': 'Re#', 'Eb': 'Mib',
      'E': 'Mi', 'E#': 'Mi#', 'Fb': 'Fab',
      'F': 'Fa', 'F#': 'Fa#', 'Gb': 'Solb',
      'G': 'Sol', 'G#': 'Sol#', 'Ab': 'Lab',
      'A': 'La', 'A#': 'La#', 'Bb': 'Sib',
      'B': 'Si', 'B#': 'Si#', 'Cb': 'Dob'
    };
    
    // Check if the note is complex like "C/E" or contains modifiers
    if (note.includes('/')) {
      const parts = note.split('/');
      return parts.map(p => noteMap[p] || p).join('/');
    }

    if (noteMap[note]) return noteMap[note];
    
    // Handle things like "Cmaj7" -> "Domaj7"
    let base = note;
    let suffix = '';
    if (note.length > 1 && (note.charAt(1) === '#' || note.charAt(1) === 'b')) {
      base = note.substring(0, 2);
      suffix = note.substring(2);
    } else {
      base = note.substring(0, 1);
      suffix = note.substring(1);
    }

    if (noteMap[base]) return noteMap[base] + suffix;

    return note;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translateNote }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
