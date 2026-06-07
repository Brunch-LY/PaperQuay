import type { ReaderSettings } from '../types/reader';

type SummaryLanguageSettings = Pick<ReaderSettings, 'summaryOutputLanguage' | 'uiLanguage'>;

export function resolveSummaryOutputLanguage(settings: SummaryLanguageSettings): string {
  const configured = settings.summaryOutputLanguage.trim();

  if (!configured || configured === 'follow-ui') {
    return settings.uiLanguage === 'en-US' ? 'English' : 'Chinese';
  }

  return configured;
}
