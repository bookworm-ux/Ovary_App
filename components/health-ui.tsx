import { Info, ShieldCheck } from 'lucide-react-native';
import { Card, Typography, useThemeColor } from 'heroui-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

interface PageIntroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageIntro({ eyebrow, title, description, action }: PageIntroProps) {
  return (
    <View className="gap-2">
      {eyebrow ? (
        <Typography className="text-accent text-xs font-semibold tracking-widest uppercase">
          {eyebrow}
        </Typography>
      ) : null}
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1 gap-2">
          <Typography.Heading type="h1" className="text-3xl leading-9">
            {title}
          </Typography.Heading>
          {description ? (
            <Typography.Paragraph color="muted">{description}</Typography.Paragraph>
          ) : null}
        </View>
        {action}
      </View>
    </View>
  );
}

export function PrivacyCard() {
  const accent = useThemeColor('accent');
  return (
    <Card className="border-accent/20 bg-accent-soft">
      <Card.Body className="flex-row gap-3">
        <ShieldCheck color={accent} size={20} />
        <View className="min-w-0 flex-1 gap-1">
          <Card.Title>Private by default</Card.Title>
          <Card.Description>
            Your health entries stay encrypted on this device. Nothing is sold, shared, or sent to
            an AI service.
          </Card.Description>
        </View>
      </Card.Body>
    </Card>
  );
}

export function MedicalDisclaimer({ compact = false }: { compact?: boolean }) {
  const muted = useThemeColor('muted');
  return (
    <View className="bg-background-secondary flex-row gap-2 rounded-2xl p-4">
      <Info color={muted} size={18} />
      <Typography.Paragraph color="muted" type="body-sm" className="min-w-0 flex-1">
        {compact
          ? 'Predictions and pattern flags are estimates, not medical findings.'
          : 'Cycle predictions and automated pattern flags are not diagnoses or medical advice. Use them to support a conversation with a healthcare provider.'}
      </Typography.Paragraph>
    </View>
  );
}

export function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <View className="gap-1">
      <Typography.Heading type="h3">{title}</Typography.Heading>
      {detail ? (
        <Typography.Paragraph type="body-sm" color="muted">
          {detail}
        </Typography.Paragraph>
      ) : null}
    </View>
  );
}
