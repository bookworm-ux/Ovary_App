import { format, subDays } from 'date-fns';
import * as Print from 'expo-print';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  Spinner,
  Switch,
  TextField,
  Typography,
  useThemeColor,
} from 'heroui-native';
import { FileText, FlaskConical, Plus, Share2, ShieldCheck } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { MedicalDisclaimer, PageIntro, SectionHeading } from '@/components/health-ui';
import { useHealthStore } from '@/lib/health-store';
import {
  CONDITION_LABELS,
  LAB_DEFINITIONS,
  SYMPTOM_LABELS,
  type HealthData,
} from '@/lib/health-types';
import {
  buildDoctorReportHtml,
  filterHealthDataByDate,
  getPatternFlags,
  getSymptomSummaries,
  hasReportEntries,
  isValidReportDate,
  safeFormatDate,
  type ReportPrivacyOptions,
} from '@/lib/report';

const today = () => format(new Date(), 'yyyy-MM-dd');
const daysAgo = (days: number) => format(subDays(new Date(), days - 1), 'yyyy-MM-dd');

type RangePreset = '30' | '90' | 'all';

function PrivacyToggle({
  label,
  detail,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-4 py-2">
      <View className="min-w-0 flex-1 gap-1">
        <Typography.Paragraph className="font-semibold">{label}</Typography.Paragraph>
        <Typography.Paragraph type="body-sm" color="muted">
          {detail}
        </Typography.Paragraph>
      </View>
      <Switch
        isSelected={value}
        onSelectedChange={onChange}
        isDisabled={disabled}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <View className="bg-background-secondary min-w-[30%] flex-1 rounded-2xl p-3">
      <Typography.Heading type="h3">{value}</Typography.Heading>
      <Typography.Paragraph type="body-sm" color="muted">
        {label}
      </Typography.Paragraph>
    </View>
  );
}

export default function ReportScreen() {
  const profile = useHealthStore((state) => state.profile);
  const periods = useHealthStore((state) => state.periods);
  const symptomLogs = useHealthStore((state) => state.symptomLogs);
  const labs = useHealthStore((state) => state.labs);
  const isHydrated = useHealthStore((state) => state.isHydrated);
  const [startDate, setStartDate] = useState(daysAgo(90));
  const [endDate, setEndDate] = useState(today());
  const [preset, setPreset] = useState<RangePreset>('90');
  const [privacy, setPrivacy] = useState<ReportPrivacyOptions>({
    includeProfile: true,
    includeMedications: true,
    includePatternFlags: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const accentForeground = useThemeColor('accent-foreground');
  const accent = useThemeColor('accent');
  const muted = useThemeColor('muted');

  const allData = useMemo<HealthData>(
    () => ({ profile, periods, symptomLogs, labs }),
    [labs, periods, profile, symptomLogs],
  );

  const dateError = useMemo(() => {
    if (!isValidReportDate(startDate) || !isValidReportDate(endDate)) {
      return 'Enter both dates as YYYY-MM-DD.';
    }
    if (startDate > endDate) return 'Start date must be before the end date.';
    return null;
  }, [endDate, startDate]);

  const filteredData = useMemo(
    () =>
      dateError
        ? { ...allData, periods: [], symptomLogs: [], labs: [] }
        : filterHealthDataByDate(allData, { startDate, endDate }),
    [allData, dateError, endDate, startDate],
  );
  const symptomSummaries = useMemo(() => getSymptomSummaries(filteredData), [filteredData]);
  const patternFlags = useMemo(() => getPatternFlags(filteredData), [filteredData]);
  const hasEntries = hasReportEntries(filteredData);

  const applyPreset = (value: RangePreset) => {
    const dates = [
      ...periods.map((period) => period.startDate),
      ...symptomLogs.map((log) => log.date),
      ...labs.map((result) => result.date),
    ].filter(isValidReportDate);
    setPreset(value);
    setEndDate(today());
    if (value === 'all') {
      setStartDate(dates.length > 0 ? dates.sort()[0] : today());
    } else {
      setStartDate(daysAgo(Number(value)));
    }
  };

  const updatePrivacy = (key: keyof ReportPrivacyOptions, value: boolean) => {
    setPrivacy((current) => ({ ...current, [key]: value }));
  };

  const exportPdf = async () => {
    if (dateError || !hasEntries) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const html = buildDoctorReportHtml(filteredData, { startDate, endDate }, privacy);
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setExportError(
          'PDF sharing is not available on this device. Open the app on iOS or Android to share it.',
        );
        return;
      }
      await Sharing.shareAsync(uri, {
        dialogTitle: 'Share doctor report',
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
    } catch {
      setExportError('The PDF could not be created. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isHydrated) {
    return (
      <View className="bg-background p-safe flex-1 items-center justify-center gap-3 px-6">
        <Spinner size="lg" />
        <Typography.Paragraph color="muted">Preparing your private report…</Typography.Paragraph>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-7 px-5 pt-safe-offset-5 pb-safe-offset-28"
      >
        <PageIntro
          eyebrow="Clinician summary"
          title="Doctor report"
          description="Choose a date range, review the included details, then create a PDF to share."
        />

        <View className="gap-3">
          <SectionHeading
            title="Date range"
            detail="Only entries within these dates are included."
          />
          <View className="flex-row flex-wrap gap-2">
            {(
              [
                ['30', 'Last 30 days'],
                ['90', 'Last 90 days'],
                ['all', 'All time'],
              ] as const
            ).map(([value, label]) => (
              <Chip
                key={value}
                variant={preset === value ? 'primary' : 'secondary'}
                onPress={() => applyPreset(value)}
              >
                <Chip.Label>{label}</Chip.Label>
              </Chip>
            ))}
          </View>
          <View className="flex-row gap-3">
            <TextField className="flex-1" isInvalid={Boolean(dateError)}>
              <Label>Start date</Label>
              <Input
                value={startDate}
                onChangeText={(value) => {
                  setPreset('all');
                  setStartDate(value);
                }}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </TextField>
            <TextField className="flex-1" isInvalid={Boolean(dateError)}>
              <Label>End date</Label>
              <Input
                value={endDate}
                onChangeText={(value) => {
                  setPreset('all');
                  setEndDate(value);
                }}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </TextField>
          </View>
          {dateError ? (
            <Typography.Paragraph type="body-sm" className="text-danger">
              {dateError}
            </Typography.Paragraph>
          ) : null}
        </View>

        <Card className="border-accent/20 bg-accent-soft">
          <Card.Body className="gap-4">
            <View className="flex-row items-start gap-3">
              <ShieldCheck color={accent} size={21} />
              <View className="min-w-0 flex-1 gap-1">
                <Card.Title>Control what leaves this device</Card.Title>
                <Card.Description>
                  Your preview stays on this device. A PDF is created only when you tap Share PDF.
                </Card.Description>
              </View>
            </View>
            <PrivacyToggle
              label="Profile details"
              detail="Include age, selected condition, height, and weight."
              value={privacy.includeProfile}
              onChange={(value) => updatePrivacy('includeProfile', value)}
              disabled={!profile}
            />
            <PrivacyToggle
              label="Medication text"
              detail="Include the medication information entered during setup."
              value={privacy.includeMedications}
              onChange={(value) => updatePrivacy('includeMedications', value)}
              disabled={!profile?.medications?.trim()}
            />
            <PrivacyToggle
              label="Automated pattern notes"
              detail="Include non-diagnostic flags based on logged cycles and displayed lab ranges."
              value={privacy.includePatternFlags}
              onChange={(value) => updatePrivacy('includePatternFlags', value)}
            />
          </Card.Body>
        </Card>

        <View className="gap-4">
          <SectionHeading
            title="Report preview"
            detail={
              dateError
                ? 'Correct the date range to preview the report.'
                : `${safeFormatDate(startDate)} – ${safeFormatDate(endDate)}`
            }
          />

          {!dateError && !hasEntries ? (
            <Card>
              <Card.Body className="items-center gap-4 px-6 py-9">
                <View className="bg-accent-soft size-12 items-center justify-center rounded-full">
                  <FileText color={accent} size={24} />
                </View>
                <View className="items-center gap-2">
                  <Card.Title>No report data in this range</Card.Title>
                  <Card.Description className="text-center">
                    Choose a wider date range or add a health entry before creating a report.
                  </Card.Description>
                </View>
                <Button variant="secondary" onPress={() => router.push('/log')}>
                  <Plus color={accent} size={18} />
                  <Button.Label>Add health entry</Button.Label>
                </Button>
              </Card.Body>
            </Card>
          ) : null}

          {hasEntries ? (
            <>
              <View className="flex-row gap-2">
                <Metric value={filteredData.periods.length} label="Periods" />
                <Metric value={filteredData.symptomLogs.length} label="Symptom logs" />
                <Metric value={filteredData.labs.length} label="Lab panels" />
              </View>

              {privacy.includeProfile && profile ? (
                <Card>
                  <Card.Body className="gap-2">
                    <Card.Title>Profile details</Card.Title>
                    <Card.Description>
                      Age {profile.age} · {CONDITION_LABELS[profile.condition]}
                      {profile.heightCm ? ` · ${profile.heightCm} cm` : ''}
                      {profile.weightKg ? ` · ${profile.weightKg} kg` : ''}
                    </Card.Description>
                  </Card.Body>
                </Card>
              ) : null}

              {privacy.includeMedications && profile?.medications?.trim() ? (
                <Card>
                  <Card.Body className="gap-2">
                    <Card.Title>Current medications</Card.Title>
                    <Card.Description>{profile.medications.trim()}</Card.Description>
                  </Card.Body>
                </Card>
              ) : null}

              <Card>
                <Card.Body className="gap-3">
                  <Card.Title>Symptoms</Card.Title>
                  {symptomSummaries.length > 0 ? (
                    symptomSummaries.map((item) => (
                      <View
                        key={item.symptom}
                        className="flex-row items-center justify-between gap-3"
                      >
                        <Typography.Paragraph className="min-w-0 flex-1">
                          {SYMPTOM_LABELS[item.symptom]}
                        </Typography.Paragraph>
                        <Typography.Paragraph type="body-sm" color="muted">
                          {item.count} {item.count === 1 ? 'log' : 'logs'} · avg{' '}
                          {item.averageSeverity.toFixed(1)}/5
                        </Typography.Paragraph>
                      </View>
                    ))
                  ) : (
                    <Card.Description>No symptom entries in this date range.</Card.Description>
                  )}
                </Card.Body>
              </Card>

              <Card>
                <Card.Body className="gap-3">
                  <View className="flex-row items-center gap-2">
                    <FlaskConical color={accent} size={19} />
                    <Card.Title>Lab values</Card.Title>
                  </View>
                  {filteredData.labs.length > 0 ? (
                    [...filteredData.labs]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((result) => (
                        <View
                          key={result.id}
                          className="border-divider gap-2 border-t pt-3 first:border-t-0 first:pt-0"
                        >
                          <Typography.Paragraph type="body-sm" color="muted">
                            {safeFormatDate(result.date)}
                          </Typography.Paragraph>
                          {Object.values(LAB_DEFINITIONS).flatMap((definition) => {
                            const value = result.values[definition.key];
                            return value === undefined
                              ? []
                              : [
                                  <View
                                    key={definition.key}
                                    className="flex-row justify-between gap-3"
                                  >
                                    <Typography.Paragraph>{definition.label}</Typography.Paragraph>
                                    <Typography.Paragraph className="font-semibold">
                                      {value} {definition.unit}
                                    </Typography.Paragraph>
                                  </View>,
                                ];
                          })}
                        </View>
                      ))
                  ) : (
                    <Card.Description>No lab values in this date range.</Card.Description>
                  )}
                </Card.Body>
              </Card>

              {privacy.includePatternFlags ? (
                <Card>
                  <Card.Body className="gap-3">
                    <Card.Title>Automated pattern notes</Card.Title>
                    {patternFlags.length > 0 ? (
                      patternFlags.map((flag) => (
                        <View key={`${flag.title}-${flag.detail}`} className="gap-1">
                          <Typography.Paragraph className="font-semibold">
                            {flag.title}
                          </Typography.Paragraph>
                          <Typography.Paragraph type="body-sm" color="muted">
                            {flag.detail}
                          </Typography.Paragraph>
                        </View>
                      ))
                    ) : (
                      <Card.Description>
                        No automated pattern notes for this date range.
                      </Card.Description>
                    )}
                  </Card.Body>
                </Card>
              ) : null}
            </>
          ) : null}
        </View>

        <MedicalDisclaimer />

        {exportError ? (
          <Typography.Paragraph type="body-sm" className="text-danger">
            {exportError}
          </Typography.Paragraph>
        ) : null}

        <Button
          size="lg"
          isDisabled={Boolean(dateError) || !hasEntries || isExporting}
          onPress={() => void exportPdf()}
        >
          {isExporting ? (
            <Spinner color={accentForeground} />
          ) : (
            <Share2 color={accentForeground} size={19} />
          )}
          <Button.Label>{isExporting ? 'Creating PDF…' : 'Share PDF'}</Button.Label>
        </Button>

        <View className="flex-row items-start gap-2 px-1">
          <ShieldCheck color={muted} size={16} />
          <Typography.Paragraph type="body-sm" color="muted" className="min-w-0 flex-1">
            Review the preview before sharing. Once shared, the copy is controlled by the receiving
            app or person.
          </Typography.Paragraph>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
