import type { Language } from '@/engine/types';
import { en, type Dict, type I18nKey } from './en';
import { hi } from './hi';
import { kn } from './kn';

export type Lang = 'en' | 'kn' | 'hi';
export type { I18nKey };

const DICTS: Record<Lang, Partial<Dict>> = { en, kn, hi };

export const LANG_OF: Record<Language, Lang> = { English: 'en', Kannada: 'kn', Hindi: 'hi' };
export const LANG_LABEL: Record<Lang, string> = { en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिन्दी' };

/** Translate a key and fill {params}. Falls back to English, then to the key itself. */
export function t(lang: Lang, key: string, params: Record<string, string | number> = {}): string {
  const tpl = (DICTS[lang] as Record<string, string | undefined>)[key] ?? (en as Record<string, string>)[key] ?? key;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

export const hasKey = (key: string) => key in en;
