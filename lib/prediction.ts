import { differenceInCalendarDays, format, parseISO } from 'date-fns';

import type { Condition, HealthData, LabKey, LabResult, PeriodLog } from '@/lib/health-types';

interface Prior {
  mean: number;
  spread: number;
  label: string;
  pcosSignals?: { available: number; severe: number };
  adjustment?: string;
}

export interface CycleStats {
  allLengths: number[];
  filteredLengths: number[];
  excludedCount: number;
  average: number | null;
  spread: number | null;
  min: number | null;
  max: number | null;
}

export interface PredictionResult {
  anchorDate: string;
  anchorIsEstimated: boolean;
  predictedDate: string;
  predictedOvulationDate: string;
  rangeStart: string;
  rangeEnd: string;
  confidenceWindowDays: number;
  estimateDays: number;
  predictionSpread: number;
  prior: Prior;
  cyclesUsed: number;
  excludedCycles: number;
  personalAverage: number | null;
  personalSpread: number | null;
  explanation: string;
}

const DAY_MS = 86_400_000;

function dateAtOffset(isoDate: string, days: number): string {
  const timestamp = parseISO(isoDate).getTime() + days * DAY_MS;
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function getCycleLengths(periods: PeriodLog[]): number[] {
  const uniqueStarts = [...new Set(periods.map((period) => period.startDate))]
    .map(parseISO)
    .sort((a, b) => a.getTime() - b.getTime());

  return uniqueStarts.slice(1).map((date, index) =>
    differenceInCalendarDays(date, uniqueStarts[index]),
  );
}

export function filterCycleLengths(lengths: number[]): {
  values: number[];
  excludedCount: number;
} {
  const valid = lengths.filter((length) => length >= 10 && length <= 90);
  if (lengths.length > 0 && valid.length === 0) {
    return { values: lengths, excludedCount: 0 };
  }
  return { values: valid, excludedCount: lengths.length - valid.length };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[]): number {
  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

export function getCycleStats(periods: PeriodLog[]): CycleStats {
  const allLengths = getCycleLengths(periods);
  const filtered = filterCycleLengths(allLengths);
  const average = filtered.values.length ? mean(filtered.values) : null;
  return {
    allLengths,
    filteredLengths: filtered.values,
    excludedCount: filtered.excludedCount,
    average,
    spread:
      filtered.values.length >= 2 ? sampleStandardDeviation(filtered.values) : null,
    min: filtered.values.length ? Math.min(...filtered.values) : null,
    max: filtered.values.length ? Math.max(...filtered.values) : null,
  };
}

export function getMostRecentLabValue(
  labs: LabResult[],
  key: LabKey,
): { value: number; date: string } | null {
  const match = [...labs]
    .filter((result) => result.values[key] !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const value = match?.values[key];
  return value === undefined || !match ? null : { value, date: match.date };
}

function getPrior(condition: Condition, labs: LabResult[], cycleLengths: number[]): Prior {
  if (condition === 'pcos') {
    let available = 0;
    let severe = 0;
    const lh = getMostRecentLabValue(labs, 'lh');
    const fsh = getMostRecentLabValue(labs, 'fsh');
    const amh = getMostRecentLabValue(labs, 'amh');

    if (lh && fsh && fsh.value !== 0) {
      available += 1;
      if (lh.value / fsh.value > 2) severe += 1;
    }
    if (amh) {
      available += 1;
      if (amh.value >= 6) severe += 1;
    }
    if (cycleLengths.length > 0) {
      available += 1;
      const longShare =
        cycleLengths.filter((length) => length >= 55).length / cycleLengths.length;
      if (longShare >= 0.3) severe += 1;
    }

    const useSevere = available > 0 && severe > available / 2;
    return {
      mean: useSevere ? 60 : 43,
      spread: useSevere ? 16 : 10,
      label: useSevere ? 'PCOS — severe starting pattern' : 'PCOS — milder starting pattern',
      pcosSignals: { available, severe },
    };
  }

  if (condition === 'hypothyroid') {
    const tsh = getMostRecentLabValue(labs, 'tsh');
    const shift = tsh ? Math.min(15, Math.max(0, tsh.value - 4) * 0.8) : 0;
    return {
      mean: 33 + shift,
      spread: 6,
      label: 'Hypothyroidism starting pattern',
      adjustment: shift > 0 ? `TSH added ${shift.toFixed(1)} days to the starting estimate` : undefined,
    };
  }

  if (condition === 'hyperthyroid') {
    const tsh = getMostRecentLabValue(labs, 'tsh');
    const ft4 = getMostRecentLabValue(labs, 'ft4');
    let multiplier = 1;
    if (tsh && ft4 && tsh.value < 0.1 && ft4.value > 1.8) multiplier = 1.5;
    else if (tsh && ft4 && tsh.value < 0.4) multiplier = 1.2;
    return {
      mean: 29.3,
      spread: 7 * multiplier,
      label: 'Hyperthyroidism starting pattern',
      adjustment:
        multiplier > 1 ? `Lab pattern widened starting uncertainty by ${multiplier}×` : undefined,
    };
  }

  if (condition === 'anemia') {
    return { mean: 29.3, spread: 3.5, label: 'General starting pattern (anemia does not shift dates)' };
  }
  return { mean: 29.3, spread: 3.5, label: 'General starting pattern' };
}

export function calculatePrediction(data: HealthData, today = new Date()): PredictionResult | null {
  if (!data.profile) return null;

  const stats = getCycleStats(data.periods);
  const prior = getPrior(data.profile.condition, data.labs, stats.filteredLengths);
  const n = stats.filteredLengths.length;
  let estimateDays = prior.mean;
  let predictionSpread = prior.spread;
  let personalSpread: number | null = null;

  if (n > 0) {
    const personalAverage = mean(stats.filteredLengths);
    personalSpread = n >= 2 ? sampleStandardDeviation(stats.filteredLengths) : prior.spread;
    personalSpread = Math.max(1, personalSpread);
    const priorWeight = 1 / prior.spread ** 2;
    const dataWeight = n / personalSpread ** 2;
    estimateDays =
      (dataWeight * personalAverage + priorWeight * prior.mean) /
      (dataWeight + priorWeight);
    const uncertaintyInEstimate = 1 / (dataWeight + priorWeight);
    predictionSpread = Math.sqrt(uncertaintyInEstimate + personalSpread ** 2);
  }

  const confidenceWindowDays = Math.round(predictionSpread * 1.96);
  const latestStart = [...data.periods].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
    ?.startDate;
  const anchorDate = latestStart ?? data.profile.baselineDate ?? today.toISOString().slice(0, 10);
  const predictedDate = dateAtOffset(anchorDate, estimateDays);
  const rangeStart = dateAtOffset(predictedDate, -confidenceWindowDays);
  const rangeEnd = dateAtOffset(predictedDate, confidenceWindowDays);
  const predictedOvulationDate = dateAtOffset(predictedDate, -12.4);

  return {
    anchorDate,
    anchorIsEstimated: !latestStart,
    predictedDate,
    predictedOvulationDate,
    rangeStart,
    rangeEnd,
    confidenceWindowDays,
    estimateDays,
    predictionSpread,
    prior,
    cyclesUsed: n,
    excludedCycles: stats.excludedCount,
    personalAverage: stats.average,
    personalSpread,
    explanation:
      n === 0
        ? `This first estimate uses the ${prior.label.toLowerCase()} until you log enough period starts to form complete cycles.`
        : `This blends the ${prior.label.toLowerCase()} with ${n} of your own complete ${n === 1 ? 'cycle' : 'cycles'}.`,
  };
}

export function formatDateRange(start: string, end: string): string {
  const startDate = parseISO(start);
  const endDate = parseISO(end);
  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${format(startDate, 'MMM d')}–${format(endDate, 'MMM d, yyyy')}`;
  }
  return `${format(startDate, 'MMM d, yyyy')}–${format(endDate, 'MMM d, yyyy')}`;
}
