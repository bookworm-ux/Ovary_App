import { format, parseISO } from 'date-fns';

import {
  LAB_DEFINITIONS,
  SYMPTOMS,
  type HealthData,
  type LabKey,
  type Symptom,
} from '@/lib/health-types';
import { getCycleStats } from '@/lib/prediction';

export interface PatternFlag {
  title: string;
  detail: string;
}

export function getSymptomCounts(data: HealthData): Record<Symptom, number> {
  return Object.fromEntries(
    SYMPTOMS.map((symptom) => [
      symptom,
      data.symptomLogs.filter((log) => log.symptoms[symptom] !== undefined).length,
    ]),
  ) as Record<Symptom, number>;
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
      if (value === undefined) continue;
      const key = rawKey as LabKey;
      const definition = LAB_DEFINITIONS[key];
      if (value < definition.normalMin || value > definition.normalMax) {
        flags.push({
          title: `${definition.label} is outside the displayed reference range`,
          detail: `${value} ${definition.unit} on ${format(parseISO(result.date), 'MMM d, yyyy')}. Reference ranges vary by laboratory and clinical context.`,
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
