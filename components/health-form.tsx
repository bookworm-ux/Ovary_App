import { Button, Typography } from 'heroui-native';
import { View } from 'react-native';

import type { Severity } from '@/lib/health-types';

export function RatingPicker({
  value,
  onChange,
  label,
}: {
  value: Severity;
  onChange: (value: Severity) => void;
  label?: string;
}) {
  return (
    <View className="gap-2">
      {label ? <Typography.Paragraph type="body-sm">{label}</Typography.Paragraph> : null}
      <View className="flex-row gap-2">
        {([1, 2, 3, 4, 5] as Severity[]).map((rating) => (
          <Button
            key={rating}
            size="sm"
            variant={rating === value ? 'primary' : 'tertiary'}
            className="min-w-0 flex-1 px-0"
            onPress={() => onChange(rating)}
          >
            {rating}
          </Button>
        ))}
      </View>
      <View className="flex-row justify-between">
        <Typography.Caption color="muted">Light</Typography.Caption>
        <Typography.Caption color="muted">Strong</Typography.Caption>
      </View>
    </View>
  );
}

export function ChoiceButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      variant={selected ? 'primary' : 'tertiary'}
      className="h-auto min-h-12 justify-start"
      onPress={onPress}
    >
      <Button.Label className="text-left">{label}</Button.Label>
    </Button>
  );
}
