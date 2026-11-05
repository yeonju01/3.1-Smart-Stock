import { ThemeConfig } from './types';

export const THEMES: ThemeConfig[] = [
  { id: 'berry', name: '핑크', color: 'rose', isDark: false },
  { id: 'soda', name: '블루', color: 'sky', isDark: false },
  { id: 'mint', name: '그린', color: 'emerald', isDark: false },
  { id: 'grape', name: '퍼플', color: 'violet', isDark: false },
  { id: 'mono', name: '흑백', color: 'zinc', isDark: false },
  { id: 'night', name: '블랙', color: 'slate', isDark: true },
];

export const QUICK_TYPES = ['포토카드', '아크릴키링', '아크릴스탠드', '스티커', '엽서'];
export const QUICK_GENRES = ['원신', '스타레일', '문스독', '괴담출근', '사카데이'];

export const DEFAULT_VAL = '기타';

export const normalizeVal = (val?: string): string => {
  const trimmed = val?.trim();
  return !trimmed || trimmed === '' ? DEFAULT_VAL : trimmed;
};
