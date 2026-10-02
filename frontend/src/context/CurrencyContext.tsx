'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

export type Currency = 'RUB' | 'USD' | 'EUR' | 'PKR';
export type Language = 'en' | 'ru';
export type Theme = 'light' | 'dark';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  currencySymbol: string;
  formatPrice: (amountInUSD: number) => string;
  language: Language;
  setLanguage: (l: Language) => void;
  theme: Theme;
  toggleTheme: () => void;
}

const RATES: Record<Currency, { symbol: string; rate: number; prefix?: boolean }> = {
  RUB: { symbol: '₽', rate: 90.0, prefix: false },
  USD: { symbol: '$', rate: 1.0, prefix: true },
  EUR: { symbol: '€', rate: 0.92, prefix: true },
  PKR: { symbol: '₨', rate: 278.0, prefix: true },
};

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrencyState] = useState<Currency>('RUB'); // RUB default like VBoost
  const [language, setLanguageState] = useState<Language>('en');
  const [theme, setThemeState] = useState<Theme>('light'); // Crisp white theme like VBoost screenshot

  useEffect(() => {
    const savedCurrency = localStorage.getItem('vboost_currency') as Currency;
    if (savedCurrency && RATES[savedCurrency]) setCurrencyState(savedCurrency);

    const savedLang = localStorage.getItem('vboost_lang') as Language;
    if (savedLang) setLanguageState(savedLang);

    const savedTheme = localStorage.getItem('vboost_theme') as Theme;
    if (savedTheme) {
      setThemeState(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem('vboost_currency', c);
  };

  const setLanguage = (l: Language) => {
    setLanguageState(l);
    localStorage.setItem('vboost_lang', l);
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setThemeState(next);
    localStorage.setItem('vboost_theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  const formatPrice = (amountInUSD: number): string => {
    const curr = RATES[currency];
    const val = (amountInUSD || 0) * curr.rate;
    const formatted = val >= 10 ? val.toFixed(2) : val.toFixed(3);
    return curr.prefix ? `${curr.symbol}${formatted}` : `${formatted} ${curr.symbol}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        currencySymbol: RATES[currency].symbol,
        formatPrice,
        language,
        setLanguage,
        theme,
        toggleTheme,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
};
