import { format } from 'date-fns';
import { router } from 'expo-router';
import { Button, Description, Input, Label, TextField, Typography } from 'heroui-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { MedicalDisclaimer, SectionHeading } from '@/components/health-ui';
import { LAB_DEFINITIONS, LABS_BY_CONDITION, type LabKey } from '@/lib/health-types';
import { useHealthStore } from '@/lib/health-store';

export default function LabsScreen() {
  const condition = useHealthStore((state) => state.profile?.condition ?? 'none');
  const addLabResult = useHealthStore((state) => state.addLabResult);
  const keys = LABS_BY_CONDITION[condition];
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [values, setValues] = useState<Partial<Record<LabKey, string>>>({});
  const [error, setError] = useState('');

  const handleSave = async () => {
    const parsed = Object.fromEntries(
      keys
        .filter((key) => values[key]?.trim())
        .map((key) => [key, Number(values[key])]),
    ) as Partial<Record<LabKey, number>>;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Object.values(parsed).some((value) => !Number.isFinite(value))) {
      setError('Check the date and enter only numeric lab values.');
      return;
    }
    if (Object.keys(parsed).length === 0) {
      setError('Enter at least one value, or close this screen to skip labs.');
      return;
    }
    await addLabResult({
      id: `lab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      values: parsed,
      createdAt: new Date().toISOString(),
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 px-5 py-6 pb-safe-offset-8">
        {keys.length === 0 ? (
          <View className="gap-4">
            <SectionHeading title="No condition-specific labs" detail="Lab entry is optional and only appears for PCOS, thyroid conditions, or anemia." />
            <Button variant="tertiary" onPress={() => router.back()}>Close</Button>
          </View>
        ) : (
          <>
            <SectionHeading title="Add lab results" detail="Enter only values from a dated lab report. Every field is optional." />
            <TextField isRequired>
              <Label>Result date</Label>
              <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
            </TextField>
            {keys.map((key) => {
              const lab = LAB_DEFINITIONS[key];
              return (
                <TextField key={key}>
                  <Label>{lab.label}</Label>
                  <Input
                    value={values[key] ?? ''}
                    onChangeText={(value) => setValues((current) => ({ ...current, [key]: value }))}
                    keyboardType="decimal-pad"
                    placeholder={`${lab.normalMin}–${lab.normalMax} ${lab.unit}`}
                  />
                  <Description>Reference range shown: {lab.normalMin}–{lab.normalMax} {lab.unit}. Your laboratory may use a different range.</Description>
                </TextField>
              );
            })}
            {condition === 'anemia' ? (
              <Typography.Paragraph color="muted" type="body-sm">
                Anemia labs can create report flags, but never change your predicted period date.
              </Typography.Paragraph>
            ) : null}
            {error ? <Typography.Paragraph className="text-danger">{error}</Typography.Paragraph> : null}
            <MedicalDisclaimer compact />
            <Button size="lg" onPress={() => void handleSave()}>
              <Button.Label>Save lab result</Button.Label>
            </Button>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
