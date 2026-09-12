import { FlashList } from '@shopify/flash-list';
import { format, isValid, parseISO, subDays } from 'date-fns';
import { router } from 'expo-router';
import { Button, Card, Chip, Dialog, Spinner, Typography, useThemeColor } from 'heroui-native';
import {
  Activity,
  CalendarDays,
  Droplets,
  FlaskConical,
  Pill,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { PageIntro } from '@/components/health-ui';
import { useHealthStore } from '@/lib/health-store';
import {
  LAB_DEFINITIONS,
  SYMPTOMS,
  SYMPTOM_LABELS,
  type LabResult,
  type PeriodLog,
  type SymptomLog,
} from '@/lib/health-types';

type EntryType = 'period' | 'symptom' | 'medication' | 'lab';
type TypeFilter = 'all' | EntryType;
type DateFilter = 'all' | '7' | '30' | '90';

type HistoryEntry =
  | { id: string; type: 'period'; date: string; createdAt: string; data: PeriodLog }
  | { id: string; type: 'symptom'; date: string; createdAt: string; data: SymptomLog }
  | { id: string; type: 'lab'; date: string; createdAt: string; data: LabResult }
  | { id: 'medication'; type: 'medication'; date: string; createdAt: string; data: string };

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All entries' },
  { value: 'period', label: 'Periods' },
  { value: 'symptom', label: 'Symptoms' },
  { value: 'medication', label: 'Medication' },
  { value: 'lab', label: 'Labs' },
];

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

function formatEntryDate(date: string) {
  const parsed = parseISO(date);
  return isValid(parsed) ? format(parsed, 'MMM d, yyyy') : date;
}

function getEntryCopy(entry: HistoryEntry) {
  switch (entry.type) {
    case 'period': {
      const details = [`Flow ${entry.data.flowIntensity} of 5`];
      if (entry.data.endDate) details.push(`Ended ${formatEntryDate(entry.data.endDate)}`);
      if (entry.data.periodLengthDays) details.push(`${entry.data.periodLengthDays} days`);
      return { title: 'Period', detail: details.join(' · ') };
    }
    case 'symptom': {
      const symptoms = SYMPTOMS.flatMap((symptom) => {
        const severity = entry.data.symptoms[symptom];
        return severity === undefined ? [] : [`${SYMPTOM_LABELS[symptom]} ${severity}/5`];
      });
      return {
        title: symptoms.length === 1 ? '1 symptom' : `${symptoms.length} symptoms`,
        detail: symptoms.join(' · '),
      };
    }
    case 'lab': {
      const values = Object.values(LAB_DEFINITIONS).flatMap((definition) => {
        const value = entry.data.values[definition.key];
        return value === undefined ? [] : [`${definition.label} ${value} ${definition.unit}`];
      });
      return { title: 'Lab values', detail: values.join(' · ') };
    }
    case 'medication':
      return { title: 'Medication', detail: entry.data };
  }

  throw new Error('Unsupported history entry type');
}

function EntryIcon({ type }: { type: EntryType }) {
  const accent = useThemeColor('accent');
  const iconProps = { color: accent, size: 20 };

  switch (type) {
    case 'period':
      return <Droplets {...iconProps} />;
    case 'symptom':
      return <Activity {...iconProps} />;
    case 'medication':
      return <Pill {...iconProps} />;
    case 'lab':
      return <FlaskConical {...iconProps} />;
  }

  return null;
}

export default function TrackScreen() {
  const profile = useHealthStore((state) => state.profile);
  const periods = useHealthStore((state) => state.periods);
  const symptomLogs = useHealthStore((state) => state.symptomLogs);
  const labs = useHealthStore((state) => state.labs);
  const isHydrated = useHealthStore((state) => state.isHydrated);
  const deletePeriod = useHealthStore((state) => state.deletePeriod);
  const deleteSymptomLog = useHealthStore((state) => state.deleteSymptomLog);
  const deleteLabResult = useHealthStore((state) => state.deleteLabResult);
  const clearMedications = useHealthStore((state) => state.clearMedications);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [pendingDelete, setPendingDelete] = useState<HistoryEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const danger = useThemeColor('danger');
  const muted = useThemeColor('muted');
  const accentForeground = useThemeColor('accent-foreground');

  const allEntries = useMemo<HistoryEntry[]>(() => {
    const entries: HistoryEntry[] = [
      ...periods.map((data) => ({
        id: data.id,
        type: 'period' as const,
        date: data.startDate,
        createdAt: data.createdAt,
        data,
      })),
      ...symptomLogs.map((data) => ({
        id: data.id,
        type: 'symptom' as const,
        date: data.date,
        createdAt: data.createdAt,
        data,
      })),
      ...labs.map((data) => ({
        id: data.id,
        type: 'lab' as const,
        date: data.date,
        createdAt: data.createdAt,
        data,
      })),
    ];

    if (profile?.medications?.trim()) {
      entries.push({
        id: 'medication',
        type: 'medication',
        date: profile.onboardingCompletedAt.slice(0, 10),
        createdAt: profile.onboardingCompletedAt,
        data: profile.medications.trim(),
      });
    }

    return entries.sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  }, [labs, periods, profile, symptomLogs]);

  const filteredEntries = useMemo(() => {
    const threshold =
      dateFilter === 'all'
        ? null
        : format(subDays(new Date(), Number.parseInt(dateFilter, 10) - 1), 'yyyy-MM-dd');

    return allEntries.filter(
      (entry) =>
        (typeFilter === 'all' || entry.type === typeFilter) &&
        (threshold === null || entry.date >= threshold),
    );
  }, [allEntries, dateFilter, typeFilter]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      switch (pendingDelete.type) {
        case 'period':
          await deletePeriod(pendingDelete.id);
          break;
        case 'symptom':
          await deleteSymptomLog(pendingDelete.id);
          break;
        case 'lab':
          await deleteLabResult(pendingDelete.id);
          break;
        case 'medication':
          await clearMedications();
          break;
      }
      setPendingDelete(null);
    } catch {
      setDeleteError('This entry could not be deleted. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderEntry = ({ item }: { item: HistoryEntry }) => {
    const copy = getEntryCopy(item);
    return (
      <Card>
        <Card.Body className="flex-row items-start gap-3 p-4">
          <View className="bg-accent-soft size-10 items-center justify-center rounded-full">
            <EntryIcon type={item.type} />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Typography.Paragraph type="body-sm" color="muted">
              {formatEntryDate(item.date)}
            </Typography.Paragraph>
            <Card.Title>{copy.title}</Card.Title>
            <Card.Description>{copy.detail}</Card.Description>
          </View>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => {
              setDeleteError(null);
              setPendingDelete(item);
            }}
            accessibilityLabel={`Delete ${copy.title.toLowerCase()} from ${formatEntryDate(item.date)}`}
          >
            <Trash2 color={danger} size={18} />
          </Button>
        </Card.Body>
      </Card>
    );
  };

  if (!isHydrated) {
    return (
      <View className="bg-background p-safe flex-1 items-center justify-center gap-3 px-6">
        <Spinner size="lg" />
        <Typography.Paragraph color="muted">Loading your private history…</Typography.Paragraph>
      </View>
    );
  }

  const hasFilters = typeFilter !== 'all' || dateFilter !== 'all';

  return (
    <View className="bg-background pt-safe flex-1">
      <FlashList
        data={filteredEntries}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderEntry}
        ItemSeparatorComponent={() => <View className="h-3" />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
        ListHeaderComponent={
          <View className="mb-5 gap-5">
            <PageIntro
              eyebrow="Health history"
              title="Track"
              description="Review your entries from newest to oldest."
              action={
                <Button
                  isIconOnly
                  size="sm"
                  onPress={() => router.push('/log')}
                  accessibilityLabel="Add health entry"
                >
                  <Plus color={accentForeground} size={19} />
                </Button>
              }
            />

            <View className="gap-2">
              <Typography.Paragraph type="body-sm" className="font-semibold">
                Entry type
              </Typography.Paragraph>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2 pr-5"
              >
                {TYPE_FILTERS.map((filter) => (
                  <Chip
                    key={filter.value}
                    size="sm"
                    variant={typeFilter === filter.value ? 'primary' : 'secondary'}
                    onPress={() => setTypeFilter(filter.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: typeFilter === filter.value }}
                  >
                    <Chip.Label>{filter.label}</Chip.Label>
                  </Chip>
                ))}
              </ScrollView>
            </View>

            <View className="gap-2">
              <Typography.Paragraph type="body-sm" className="font-semibold">
                Date range
              </Typography.Paragraph>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2 pr-5"
              >
                {DATE_FILTERS.map((filter) => (
                  <Chip
                    key={filter.value}
                    size="sm"
                    variant={dateFilter === filter.value ? 'primary' : 'secondary'}
                    onPress={() => setDateFilter(filter.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: dateFilter === filter.value }}
                  >
                    <Chip.Label>{filter.label}</Chip.Label>
                  </Chip>
                ))}
              </ScrollView>
            </View>

            {filteredEntries.length > 0 ? (
              <Typography.Paragraph type="body-sm" color="muted">
                {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
              </Typography.Paragraph>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Card variant="secondary">
            <Card.Body className="items-center gap-3 px-6 py-8">
              <View className="bg-accent-soft size-12 items-center justify-center rounded-full">
                <CalendarDays color={muted} size={23} />
              </View>
              <View className="items-center gap-1">
                <Card.Title>{hasFilters ? 'No matching entries' : 'No entries yet'}</Card.Title>
                <Card.Description className="text-center">
                  {hasFilters
                    ? 'Try a different entry type or date range.'
                    : 'Log a period or symptoms to start your private history.'}
                </Card.Description>
              </View>
              {hasFilters ? (
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => {
                    setTypeFilter('all');
                    setDateFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onPress={() => router.push('/log')}>
                  Add first entry
                </Button>
              )}
            </Card.Body>
          </Card>
        }
      />

      <Dialog
        isOpen={pendingDelete !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isDeleting) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <View className="mb-5 gap-2">
              <Dialog.Title>Delete this entry?</Dialog.Title>
              <Dialog.Description>
                {pendingDelete
                  ? `${getEntryCopy(pendingDelete).title} from ${formatEntryDate(pendingDelete.date)} will be removed from this device.`
                  : 'This entry will be removed from this device.'}
              </Dialog.Description>
              {deleteError ? (
                <Typography.Paragraph type="body-sm" className="text-danger">
                  {deleteError}
                </Typography.Paragraph>
              ) : null}
            </View>
            <View className="flex-row justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                isDisabled={isDeleting}
                onPress={() => setPendingDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isDisabled={isDeleting}
                onPress={() => void confirmDelete()}
              >
                {isDeleting ? <Spinner size="sm" color="default" /> : null}
                <Button.Label>{isDeleting ? 'Deleting' : 'Delete'}</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}
