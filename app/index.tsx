// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/astro" />; // land on your first tab
}
