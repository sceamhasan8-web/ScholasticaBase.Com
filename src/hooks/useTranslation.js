import { useCallback } from 'react';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import en from '../locales/en.json';
import bn from '../locales/bn.json';

const LOCALES = { en, bn };

/**
 * useTranslation
 *
 * Reads the active language from `schoolProfile.language` (set by the Admin)
 * and returns a `t(key)` resolver that supports dot-path notation.
 *
 * Examples:
 *   t('common.save')          → "Save" or "সংরক্ষণ করুন"
 *   t('routine.days')         → ["Sunday","Monday",...] or ["রবিবার","সোমবার",...]
 *   t('routine.days.0')       → "Sunday" or "রবিবার"
 *
 * Falls back to English if:
 *   - The active language is unknown
 *   - A key is missing in the active locale
 *
 * The `t` function is memoized with `useCallback` so that its reference only
 * changes when the active language changes. This means any `useMemo` or
 * `useCallback` block that lists `t` in its dependency array will recompute
 * instantly on a language switch, giving us true reactivity without a page reload.
 */
export default function useTranslation() {
  const { schoolProfile } = useSchoolProfile();
  const language = (schoolProfile?.language === 'bn') ? 'bn' : 'en';

  const t = useCallback((key) => {
    const dict = LOCALES[language] ?? LOCALES.en;
    const parts = key.split('.');
    let val = dict;

    for (const part of parts) {
      if (val == null || typeof val !== 'object') {
        val = undefined;
        break;
      }
      val = val[part];
    }

    // Successful resolution: return value as-is (string or array)
    if (val !== undefined) return val;

    // Key missing in active locale → fallback to English
    let fallback = LOCALES.en;
    for (const part of parts) {
      if (fallback == null || typeof fallback !== 'object') {
        fallback = undefined;
        break;
      }
      fallback = fallback[part];
    }

    // Return the fallback value, or the raw key as last resort
    return fallback !== undefined ? fallback : key;
  }, [language]); // ← new reference produced on every language change

  return { t, lang: language };
}
