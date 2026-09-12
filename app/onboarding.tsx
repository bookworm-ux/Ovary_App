import { router } from 'expo-router';
import { Button, Description, Input, Label, TextField, Typography } from 'heroui-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { ChoiceButton } from '@/components/health-form';
import { MedicalDisclaimer, PageIntro, PrivacyCard, SectionHeading } from '@/components/health-ui';
import { CONDITIONS, type Condition } from '@/lib/health-types';
import { useHealthStore } from '@/lib/health-store';

export default function OnboardingScreen() {
  const saveProfile = useHealthStore((state) => state.saveProfile);
  const existingProfile = useHealthStore((state) => state.profile);
  const [age, setAge] = useState(existingProfile?.age?.toString() ?? '');
  const [height, setHeight] = useState(existingProfile?.heightCm?.toString() ?? '');
  const [weight, setWeight] = useState(existingProfile?.weightKg?.toString() ?? '');
  const [condition, setCondition] = useState<Condition>(existingProfile?.condition ?? 'none');
  const [medications, setMedications] = useState(existingProfile?.medications ?? '');
  const [error, setError] = useState('');

  const handleContinue = async () => {
    const numericAge = Number(age);
    if (!Number.isFinite(numericAge) || numericAge < 13 || numericAge > 100) {
      setError('Enter an age from 13 to 100.');
      return;
    }
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    await saveProfile({
      age: numericAge,
      heightCm: height ? Number(height) : undefined,
      weightKg: weight ? Number(weight) : undefined,
      condition,
      medications: medications.trim() || undefined,
      baselineDate: existingProfile?.baselineDate ?? today,
      onboardingCompletedAt: existingProfile?.onboardingCompletedAt ?? now.toISOString(),
    });
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-7 px-5 pb-safe-offset-8 pt-safe-offset-6"
      >
        <PageIntro
          eyebrow="Welcome"
          title="Predictions built around your pattern"
          description="A condition-aware starting point that becomes more personal as you log cycles."
        />
        <PrivacyCard />

        <View className="gap-4">
          <SectionHeading title="About you" detail="Height and weight are optional and do not change cycle predictions." />
          <TextField isRequired isInvalid={Boolean(error)}>
            <Label>Age</Label>
            <Input value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="e.g. 28" />
            {error ? <Typography.Caption className="text-danger">{error}</Typography.Caption> : null}
          </TextField>
          <View className="flex-row gap-3">
            <TextField className="flex-1">
              <Label>Height (cm)</Label>
              <Input value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="Optional" />
            </TextField>
            <TextField className="flex-1">
              <Label>Weight (kg)</Label>
              <Input value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Optional" />
            </TextField>
          </View>
        </View>

        <View className="gap-3">
          <SectionHeading title="Diagnosed condition" detail="Choose only a condition diagnosed by a healthcare professional." />
          {CONDITIONS.map((item) => (
            <ChoiceButton
              key={item.value}
              label={item.label}
              selected={condition === item.value}
              onPress={() => setCondition(item.value)}
            />
          ))}
        </View>

        <TextField>
          <Label>Current medications</Label>
          <Input value={medications} onChangeText={setMedications} placeholder="Optional" />
          <Description>Free text, such as medication names and doses.</Description>
        </TextField>

        <MedicalDisclaimer />
        <Button size="lg" onPress={() => void handleContinue()}>
          <Button.Label>See my starting estimate</Button.Label>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
