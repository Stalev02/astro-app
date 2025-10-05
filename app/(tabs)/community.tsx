// app/(tabs)/community.tsx
import { Text, View } from 'react-native';
export default function CommunityScreen() {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700' }}>
        Сообщество & Друзья
      </Text>
      <Text>Социальный хаб и друзья.</Text>
    </View>
  );
}
