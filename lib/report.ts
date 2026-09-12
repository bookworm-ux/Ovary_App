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
