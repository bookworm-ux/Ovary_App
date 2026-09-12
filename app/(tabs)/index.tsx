import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Redirect, router } from 'expo-router';
import { Button, Card, Typography, useThemeColor } from 'heroui-native';
import { CalendarDays, ChevronRight, FlaskConical, Plus } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { MedicalDisclaimer, PageIntro, PrivacyCard, SectionHeading } from '@/components/health-ui';
import { OvaryLogo } from '@/components/OvaryLogo';
import { useHealthStore } from '@/lib/health-store';
import { calculatePrediction, formatDateRange } from '@/lib/prediction';

export default function HomeScreen() {
  const profile = useHealthStore((state) => state.profile);
  const periods = useHealthStore((state) => state.periods);
  const labs = useHealthStore((state) => state.labs);
  const symptomLogs = useHealthStore((state) => state.symptomLogs);
  const addPeriod = useHealthStore((state) => state.addPeriod);
  const accent = useThemeColor('accent');

  if (!profile) return <Redirect href="/onboarding" />;

  const data = { profile, periods, labs, symptomLogs };
  const prediction = calculatePrediction(data);
  const latestStart = [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
    ?.startDate;
  const cycleDay = latestStart
    ? Math.max(1, differenceInCalendarDays(new Date(), parseISO(latestStart)) + 1)
    : null;

  const logToday = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const alreadyLogged = periods.some((period) => period.startDate === today);
    if (!alreadyLogged) {
      await addPeriod({
        id: `period-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startDate: today,
        flowIntensity: 3,
        createdAt: new Date().toISOString(),
      });
    }
  };

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-6 px-5 pb-safe-offset-28 pt-safe-offset-5"
    >
      <View className="items-center pb-1">
        <OvaryLogo compact size={44} />
      </View>

      <PageIntro
        eyebrow={cycleDay ? `Cycle day ${cycleDay}` : 'Your first estimate'}
        title="Your cycle, without the 28-day assumption"
        description={
          latestStart
            ? `Last period started ${format(parseISO(latestStart), 'MMM d, yyyy')}.`
            : 'Log your first period when it begins. Until then, this estimate starts from today.'
        }
      />

      <Card className="bg-accent-soft overflow-hidden">
        <Card.Body className="gap-5 p-5">
          <View className="flex-row items-center gap-2">
            <CalendarDays color={accent} size={20} />
            <Typography.Paragraph type="body-sm" className="text-accent">
              Predicted next period range
            </Typography.Paragraph>
          </View>
          <View className="gap-1">
            <Typography.Heading type="h2" className="text-3xl">
              {prediction
                ? formatDateRange(prediction.rangeStart, prediction.rangeEnd)
                : 'Unavailable'}
            </Typography.Heading>
            <Typography.Paragraph color="muted">
              {prediction?.anchorIsEstimated
                ? 'Starting estimate — it will reset from your first logged period.'
                : `Around ${prediction ? format(parseISO(prediction.predictedDate), 'MMM d') : ''}, with uncertainty shown.`}
            </Typography.Paragraph>
          </View>
          <Button variant="tertiary" onPress={() => router.push('/prediction')}>
            <Button.Label>How this was calculated</Button.Label>
            <ChevronRight color={accent} size={18} />
          </Button>
        </Card.Body>
      </Card>

      <Button size="lg" onPress={() => void logToday()}>
        <Plus size={20} color="white" />
        <Button.Label>Period started today</Button.Label>
      </Button>
      <Button variant="tertiary" onPress={() => router.push('/log')}>
        Add details or another date
      </Button>

      <View className="gap-3">
        <SectionHeading
          title="Optional inputs"
          detail="Your predictions work without labs. Add them only if you want to."
        />
        <Card>
          <Card.Body className="flex-row items-center gap-3">
            <FlaskConical color={accent} size={20} />
            <View className="min-w-0 flex-1">
              <Card.Title>Condition-specific labs</Card.Title>
              <Card.Description>Only the most recent dated value is used.</Card.Description>
            </View>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => router.push('/labs')}
              accessibilityLabel="Add lab values"
            >
              <ChevronRight color={accent} size={18} />
            </Button>
          </Card.Body>
        </Card>
      </View>

      <MedicalDisclaimer />
      <PrivacyCard />
    </ScrollView>
  );
}
