import { format } from 'date-fns';
import { router } from 'expo-router';
import { Button, Input, Label, TextField, Typography } from 'heroui-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { ChoiceButton, RatingPicker } from '@/components/health-form';
import { MedicalDisclaimer, SectionHeading } from '@/components/health-ui';
import {
  SYMPTOMS,
  SYMPTOM_LABELS,
  type Severity,
  type Symptom,
} from '@/lib/health-types';
import { useHealthStore } from '@/lib/health-store';

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function LogScreen() {
  const addPeriod = useHealthStore((state) => state.addPeriod);
  const addSymptomLog = useHealthStore((state) => state.addSymptomLog);
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [periodLength, setPeriodLength] = useState('');
  const [flow, setFlow] = useState<Severity>(3);
  const [symptoms, setSymptoms] = useState<Partial<Record<Symptom, Severity>>>({});
  const [error, setError] = useState('');
  const selected = useMemo(() => new Set(Object.keys(symptoms)), [symptoms]);

  const toggleSymptom = (symptom: Symptom) => {
    setSymptoms((current) => {
      const next = { ...current };
      if (next[symptom]) delete next[symptom];
      else next[symptom] = 3;
      return next;
    });
  };

  const handleSave = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setError('Use YYYY-MM-DD for the period start date.');
      return;
    }
    const length = periodLength ? Number(periodLength) : undefined;
    await addPeriod({
      id: makeId('period'),
      startDate,
      endDate: endDate || undefined,
      periodLengthDays: length && length > 0 ? length : undefined,
      flowIntensity: flow,
      createdAt: new Date().toISOString(),
    });
    if (Object.keys(symptoms).length > 0) {
      await addSymptomLog({
        id: makeId('symptoms'),
        date: startDate,
        symptoms,
        createdAt: new Date().toISOString(),
      });
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-7 px-5 py-6 pb-safe-offset-8">
        <View className="gap-4">
          <SectionHeading title="Period details" detail="Start date is required. Add an end date or length whenever you know it." />
          <TextField isRequired isInvalid={Boolean(error)}>
            <Label>Start date</Label>
            <Input value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
            {error ? <Typography.Caption className="text-danger">{error}</Typography.Caption> : null}
          </TextField>
          <View className="flex-row gap-3">
            <TextField className="flex-1">
              <Label>End date</Label>
              <Input value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
            </TextField>
            <TextField className="flex-1">
              <Label>Length (days)</Label>
              <Input value={periodLength} onChangeText={setPeriodLength} placeholder="Optional" keyboardType="number-pad" />
            </TextField>
          </View>
          <RatingPicker value={flow} onChange={setFlow} label="Flow intensity" />
        </View>

        <View className="gap-3">
          <SectionHeading title="Symptoms" detail="Optional. Select any symptom, then set how strong it felt." />
          <View className="flex-row flex-wrap gap-2">
            {SYMPTOMS.map((symptom) => (
              <View key={symptom} className="w-[48%]">
                <ChoiceButton label={SYMPTOM_LABELS[symptom]} selected={selected.has(symptom)} onPress={() => toggleSymptom(symptom)} />
              </View>
            ))}
          </View>
          {SYMPTOMS.filter((symptom) => symptoms[symptom]).map((symptom) => (
            <RatingPicker
              key={symptom}
              label={SYMPTOM_LABELS[symptom]}
              value={symptoms[symptom] ?? 3}
              onChange={(value) => setSymptoms((current) => ({ ...current, [symptom]: value }))}
            />
          ))}
        </View>

        <MedicalDisclaimer compact />
        <Button size="lg" onPress={() => void handleSave()}>
          <Button.Label>Save entry</Button.Label>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
