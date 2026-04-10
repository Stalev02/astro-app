// src/shared/i18n/index.ts
import { useApp } from '@/src/store/app';
import { strings } from './strings';

export function useT() {
  const language = useApp((s) => s.language);
  return strings[language];
}

export { strings };
export type { Language, Strings } from './strings';
