import type { PdfReadingHeatmap } from '../../types/reader';

export const READING_TIME_CHART_BAR_COUNT = 24;

export function aggregateReadingTimeChartBins(heatmap: PdfReadingHeatmap | null): number[] {
  const sourceBins = heatmap?.bins ?? [];

  if (sourceBins.length === 0) {
    return Array.from({ length: READING_TIME_CHART_BAR_COUNT }, () => 0);
  }

  return Array.from({ length: READING_TIME_CHART_BAR_COUNT }, (_, index) => {
    const start = Math.floor((index / READING_TIME_CHART_BAR_COUNT) * sourceBins.length);
    const end = Math.max(
      start + 1,
      Math.floor(((index + 1) / READING_TIME_CHART_BAR_COUNT) * sourceBins.length),
    );
    let totalMs = 0;

    for (let binIndex = start; binIndex < end; binIndex += 1) {
      const value = sourceBins[binIndex];

      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        totalMs += value;
      }
    }

    return Math.round(totalMs);
  });
}
