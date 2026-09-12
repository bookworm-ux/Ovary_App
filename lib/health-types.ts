export type Condition = 'none' | 'pcos' | 'hypothyroid' | 'hyperthyroid' | 'anemia';

export type Severity = 1 | 2 | 3 | 4 | 5;

export const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'none', label: 'No diagnosed condition' },
  { value: 'pcos', label: 'PCOS' },
  { value: 'hypothyroid', label: 'Hypothyroidism' },
  { value: 'hyperthyroid', label: 'Hyperthyroidism' },
  { value: 'anemia', label: 'Anemia' },
];

export const CONDITION_LABELS: Record<Condition, string> = {
  none: 'No diagnosed condition',
  pcos: 'PCOS',
  hypothyroid: 'Hypothyroidism',
  hyperthyroid: 'Hyperthyroidism',
  anemia: 'Anemia',
};

export const SYMPTOMS = [
  'cramps',
  'fatigue',
  'moodSwings',
  'headache',
  'bloating',
  'hotFlashes',
  'coldIntolerance',
  'heavyBleeding',
  'spotting',
  'acne',
  'hairLoss',
  'dizziness',
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

export const SYMPTOM_LABELS: Record<Symptom, string> = {
  cramps: 'Cramps',
  fatigue: 'Fatigue',
  moodSwings: 'Mood swings',
  headache: 'Headache',
  bloating: 'Bloating',
  hotFlashes: 'Hot flashes',
  coldIntolerance: 'Cold intolerance',
  heavyBleeding: 'Heavy bleeding',
  spotting: 'Spotting',
  acne: 'Acne',
  hairLoss: 'Hair loss',
  dizziness: 'Dizziness',
};

export interface Profile {
  age: number;
  heightCm?: number;
  weightKg?: number;
  condition: Condition;
  medications?: string;
  baselineDate: string;
  onboardingCompletedAt: string;
}

export interface PeriodLog {
  id: string;
  startDate: string;
  endDate?: string;
  periodLengthDays?: number;
  flowIntensity: Severity;
  createdAt: string;
}

export interface SymptomLog {
  id: string;
  date: string;
  symptoms: Partial<Record<Symptom, Severity>>;
  createdAt: string;
}

export type LabKey = 'tsh' | 'ft4' | 'lh' | 'fsh' | 'amh' | 'hemoglobin' | 'ferritin';

export interface LabResult {
  id: string;
  date: string;
  values: Partial<Record<LabKey, number>>;
  createdAt: string;
}

export interface HealthData {
  profile: Profile | null;
  periods: PeriodLog[];
  symptomLogs: SymptomLog[];
  labs: LabResult[];
}

export const EMPTY_HEALTH_DATA: HealthData = {
  profile: null,
  periods: [],
  symptomLogs: [],
  labs: [],
};

export interface LabDefinition {
  key: LabKey;
  label: string;
  unit: string;
  normalMin: number;
  normalMax: number;
}

export const LAB_DEFINITIONS: Record<LabKey, LabDefinition> = {
  tsh: { key: 'tsh', label: 'TSH', unit: 'mIU/L', normalMin: 0.4, normalMax: 4 },
  ft4: { key: 'ft4', label: 'Free T4', unit: 'ng/dL', normalMin: 0.8, normalMax: 1.8 },
  lh: { key: 'lh', label: 'LH', unit: 'IU/L', normalMin: 1.9, normalMax: 12.5 },
  fsh: { key: 'fsh', label: 'FSH', unit: 'IU/L', normalMin: 2.5, normalMax: 10.2 },
  amh: { key: 'amh', label: 'AMH', unit: 'ng/mL', normalMin: 1, normalMax: 4 },
  hemoglobin: {
    key: 'hemoglobin',
    label: 'Hemoglobin',
    unit: 'g/dL',
    normalMin: 12,
    normalMax: 16,
  },
  ferritin: { key: 'ferritin', label: 'Ferritin', unit: 'ng/mL', normalMin: 15, normalMax: 150 },
};

export const LABS_BY_CONDITION: Record<Condition, LabKey[]> = {
  none: [],
  pcos: ['lh', 'fsh', 'amh'],
  hypothyroid: ['tsh', 'ft4'],
  hyperthyroid: ['tsh', 'ft4'],
  anemia: ['hemoglobin', 'ferritin'],
};
