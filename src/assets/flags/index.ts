// Flag SVGs from https://flagicons.lipis.dev/
export const flags = {
  en: 'https://flagcdn.com/us.svg',  // USA flag for English
  es: 'https://flagcdn.com/es.svg',  // Spain flag for Spanish
  fr: 'https://flagcdn.com/fr.svg',  // France flag for French
  de: 'https://flagcdn.com/de.svg',  // Germany flag for German
  pt: 'https://flagcdn.com/br.svg',  // Brazil flag for Portuguese
  zh: 'https://flagcdn.com/cn.svg',  // China flag for Chinese
  ja: 'https://flagcdn.com/jp.svg',  // Japan flag for Japanese
  ko: 'https://flagcdn.com/kr.svg',  // South Korea flag for Korean
  ar: 'https://flagcdn.com/sa.svg',  // Saudi Arabia flag for Arabic
} as const;

export type FlagCode = keyof typeof flags; 