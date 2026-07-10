import { Tabs } from "expo-router"
import { Text } from "react-native"

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerStyle: { backgroundColor: "#16A34A" }, headerTintColor: "#fff", tabBarActiveTintColor: "#16A34A", tabBarStyle: { borderTopColor: "#e2e8f0" } }}>
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: () => <Text>🏠</Text> }} />
      <Tabs.Screen name="circles" options={{ title: "Circles", tabBarIcon: () => <Text>👥</Text> }} />
      <Tabs.Screen name="portfolio" options={{ title: "Portfolio", tabBarIcon: () => <Text>📊</Text> }} />
      <Tabs.Screen name="notifications" options={{ title: "Alerts", tabBarIcon: () => <Text>🔔</Text> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: () => <Text>⚙️</Text> }} />
    </Tabs>
  )
}
