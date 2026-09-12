import { Typography } from 'heroui-native';
import { View } from 'react-native';

export default function SettingsScreen() {
  return (
    <View className="bg-background p-safe flex-1 items-center justify-center px-6">
      <Typography.Heading type="h2">Settings</Typography.Heading>
    </View>
  );
}
