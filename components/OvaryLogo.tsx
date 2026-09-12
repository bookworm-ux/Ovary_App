import { Image, View } from 'react-native';

const LOGO_SHEET = require('@/assets/lutea-logo.png');
const SHEET_WIDTH = 1536;
const SHEET_HEIGHT = 1024;

type OvaryLogoProps = {
  compact?: boolean;
  size?: number;
};

export function OvaryLogo({ compact = false, size = compact ? 52 : 72 }: OvaryLogoProps) {
  const crop = compact
    ? { x: 0, y: 392, width: 128, height: 128 }
    : { x: 450, y: 370, width: 440, height: 180 };
  const scale = size / (compact ? crop.width : 96);
  const width = crop.width * scale;
  const height = crop.height * scale;

  return (
    <View
      style={{ width, height, overflow: 'hidden' }}
      accessibilityRole="image"
      accessibilityLabel="Ovary logo"
    >
      <Image
        source={LOGO_SHEET}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: SHEET_WIDTH * scale,
          height: SHEET_HEIGHT * scale,
          left: -crop.x * scale,
          top: -crop.y * scale,
        }}
      />
    </View>
  );
}
