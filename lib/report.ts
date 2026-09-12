import { format, isValid, parseISO } from 'date-fns';

import {
  CONDITION_LABELS,
  LAB_DEFINITIONS,
  SYMPTOMS,
  SYMPTOM_LABELS,
  type HealthData,
  type LabKey,
  type Symptom,
} from '@/lib/health-types';
import { getCycleStats } from '@/lib/prediction';

export interface PatternFlag {
  title: string;
  detail: string;
}

function isLabKey(value: string): value is LabKey {
  return Object.hasOwn(LAB_DEFINITIONS, value);
}

export function getSymptomCounts(data: HealthData): Record<Symptom, number> {
  const counts: Record<Symptom, number> = {
    cramps: 0,
    fatigue: 0,
    moodSwings: 0,
    headache: 0,
    bloating: 0,
    hotFlashes: 0,
    coldIntolerance: 0,
    heavyBleeding: 0,
    spotting: 0,
    acne: 0,
    hairLoss: 0,
    dizziness: 0,
  };

  for (const log of data.symptomLogs) {
    for (const symptom of SYMPTOMS) {
      if (log.symptoms[symptom] !== undefined) counts[symptom] += 1;
    }
  }

  return counts;
}

export function getPatternFlags(data: HealthData): PatternFlag[] {
  const flags: PatternFlag[] = [];
  const stats = getCycleStats(data.periods);
  if ((stats.spread ?? 0) > 7 || (stats.max ?? 0) - (stats.min ?? 0) > 14) {
    flags.push({
      title: 'Cycle length varies substantially',
      detail: 'Consider reviewing the timing and possible contributors with the patient.',
    });
  }

  const flows = data.periods.map((period) => period.flowIntensity);
  if (flows.length >= 2 && flows.filter((flow) => flow >= 4).length / flows.length >= 0.5) {
    flags.push({
      title: 'Heavy flow is logged often',
      detail: 'Flow was rated 4–5 in at least half of logged periods.',
    });
  }

  for (const result of data.labs) {
    for (const [rawKey, value] of Object.entries(result.values)) {
      if (value === undefined || !isLabKey(rawKey)) continue;
      const definition = LAB_DEFINITIONS[rawKey];
      if (value < definition.normalMin || value > definition.normalMax) {
        flags.push({
          title: `${definition.label} is outside the displayed reference range`,
          detail: `${value} ${definition.unit} on ${safeFormatDate(result.date)}. Reference ranges vary by laboratory and clinical context.`,
        });
      }
    }
  }

  return flags;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export interface ReportDateRange {
  startDate: string;
  endDate: string;
}

export interface ReportPrivacyOptions {
  includeProfile: boolean;
  includeMedications: boolean;
  includePatternFlags: boolean;
}

export interface SymptomSummary {
  symptom: Symptom;
  count: number;
  averageSeverity: number;
  maximumSeverity: number;
}

export function safeFormatDate(value: string, pattern = 'MMM d, yyyy'): string {
  const date = parseISO(value);
  return isValid(date) ? format(date, pattern) : value;
}

export function isValidReportDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return isValid(parseISO(value));
}

export function filterHealthDataByDate(
  data: HealthData,
  { startDate, endDate }: ReportDateRange,
): HealthData {
  const inRange = (date: string) => date >= startDate && date <= endDate;
  return {
    profile: data.profile,
    periods: data.periods.filter((period) => inRange(period.startDate)),
    symptomLogs: data.symptomLogs.filter((log) => inRange(log.date)),
    labs: data.labs.filter((result) => inRange(result.date)),
  };
}

export function getSymptomSummaries(data: HealthData): SymptomSummary[] {
  return SYMPTOMS.flatMap((symptom) => {
    const severities = data.symptomLogs.flatMap((log) => {
      const severity = log.symptoms[symptom];
      return severity === undefined ? [] : [severity];
    });
    if (severities.length === 0) return [];
    return [
      {
        symptom,
        count: severities.length,
        averageSeverity: severities.reduce((total, value) => total + value, 0) / severities.length,
        maximumSeverity: Math.max(...severities),
      },
    ];
  }).sort((a, b) => b.count - a.count || b.averageSeverity - a.averageSeverity);
}

export function hasReportEntries(data: HealthData): boolean {
  return data.periods.length + data.symptomLogs.length + data.labs.length > 0;
}

export function buildDoctorReportHtml(
  data: HealthData,
  range: ReportDateRange,
  privacy: ReportPrivacyOptions,
): string {
  const stats = getCycleStats(data.periods);
  const symptoms = getSymptomSummaries(data);
  const flags = privacy.includePatternFlags ? getPatternFlags(data) : [];
  const profile = data.profile;
  const generatedAt = format(new Date(), 'MMM d, yyyy');
  const rangeLabel = `${safeFormatDate(range.startDate)} – ${safeFormatDate(range.endDate)}`;

  const profileRows =
    privacy.includeProfile && profile
      ? `<section><h2>Patient-provided profile</h2><table>
          <tr><th>Age</th><td>${profile.age}</td></tr>
          <tr><th>Condition</th><td>${escapeHtml(CONDITION_LABELS[profile.condition])}</td></tr>
          ${profile.heightCm ? `<tr><th>Height</th><td>${profile.heightCm} cm</td></tr>` : ''}
          ${profile.weightKg ? `<tr><th>Weight</th><td>${profile.weightKg} kg</td></tr>` : ''}
        </table></section>`
      : '';

  const medicationRows =
    privacy.includeMedications && profile?.medications?.trim()
      ? `<section><h2>Current medications</h2><p>${escapeHtml(profile.medications.trim())}</p></section>`
      : '';

  const periodRows = [...data.periods]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map(
      (period) =>
        `<tr><td>${escapeHtml(safeFormatDate(period.startDate))}</td><td>${period.endDate ? escapeHtml(safeFormatDate(period.endDate)) : '—'}</td><td>${period.flowIntensity}/5</td><td>${period.periodLengthDays ?? '—'}</td></tr>`,
    )
    .join('');

  const symptomRows = symptoms
    .map(
      (item) =>
        `<tr><td>${escapeHtml(SYMPTOM_LABELS[item.symptom])}</td><td>${item.count}</td><td>${item.averageSeverity.toFixed(1)}/5</td><td>${item.maximumSeverity}/5</td></tr>`,
    )
    .join('');

  const labRows = [...data.labs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((result) =>
      Object.values(LAB_DEFINITIONS).flatMap((definition) => {
        const value = result.values[definition.key];
        if (value === undefined) return [];
        const outside = value < definition.normalMin || value > definition.normalMax;
        return [
          `<tr><td>${escapeHtml(safeFormatDate(result.date))}</td><td>${escapeHtml(definition.label)}</td><td>${value} ${escapeHtml(definition.unit)}</td><td>${definition.normalMin}–${definition.normalMax} ${escapeHtml(definition.unit)}</td><td>${outside ? 'Outside displayed range' : 'Within displayed range'}</td></tr>`,
        ];
      }),
    )
    .join('');

  const flagRows = flags
    .map(
      (flag) =>
        `<div class="note"><strong>${escapeHtml(flag.title)}</strong><br>${escapeHtml(flag.detail)}</div>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 36px; }
    body { color: #261d22; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 12px; line-height: 1.45; }
    header { border-bottom: 2px solid #b83f67; margin-bottom: 22px; padding-bottom: 14px; }
    h1 { font-size: 25px; margin: 0 0 4px; } h2 { color: #7c2948; font-size: 16px; margin: 22px 0 8px; }
    p { margin: 5px 0; } .muted { color: #6f6469; } .summary { display: flex; gap: 10px; margin-top: 14px; }
    .metric { background: #faeef2; border-radius: 8px; flex: 1; padding: 10px; } .metric strong { display: block; font-size: 18px; }
    table { border-collapse: collapse; width: 100%; } th { background: #faeef2; color: #633044; text-align: left; }
    th, td { border-bottom: 1px solid #e9dfe3; padding: 7px 6px; vertical-align: top; }
    .note { border-left: 3px solid #b83f67; margin: 8px 0; padding: 7px 10px; background: #fcf5f7; }
    footer { border-top: 1px solid #d9ced2; color: #6f6469; font-size: 10px; margin-top: 26px; padding-top: 10px; }
  </style></head><body>
    <header><h1>Health summary for clinician review</h1><p>${escapeHtml(rangeLabel)}</p><p class="muted">Generated ${escapeHtml(generatedAt)} from patient-entered data</p></header>
    <div class="summary">
      <div class="metric"><strong>${data.periods.length}</strong>period entries</div>
      <div class="metric"><strong>${data.symptomLogs.length}</strong>symptom logs</div>
      <div class="metric"><strong>${data.labs.length}</strong>lab panels</div>
    </div>
    ${profileRows}${medicationRows}
    <section><h2>Cycle summary</h2><p>${stats.average ? `Average logged cycle: ${stats.average.toFixed(1)} days (${stats.filteredLengths.length} cycle${stats.filteredLengths.length === 1 ? '' : 's'} used).` : 'Not enough complete cycle data to calculate an average.'}</p>
      ${periodRows ? `<table><tr><th>Start</th><th>End</th><th>Flow</th><th>Length</th></tr>${periodRows}</table>` : '<p>No period entries in this date range.</p>'}</section>
    <section><h2>Symptoms</h2>${symptomRows ? `<table><tr><th>Symptom</th><th>Logs</th><th>Average severity</th><th>Highest</th></tr>${symptomRows}</table>` : '<p>No symptom entries in this date range.</p>'}</section>
    <section><h2>Lab values</h2>${labRows ? `<table><tr><th>Date</th><th>Test</th><th>Value</th><th>Displayed range</th><th>App comparison</th></tr>${labRows}</table>` : '<p>No lab values in this date range.</p>'}</section>
    ${privacy.includePatternFlags ? `<section><h2>Automated pattern notes</h2>${flagRows || '<p>No automated pattern notes for this date range.</p>'}</section>` : ''}
    <footer>This report summarizes patient-entered information. Automated comparisons use general displayed ranges that may differ from the reporting laboratory. Predictions and pattern notes are estimates, not diagnoses or medical advice. A healthcare professional should verify all information and interpret it in clinical context.</footer>
  </body></html>`;
}
