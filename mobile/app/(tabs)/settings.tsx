import { Text, TouchableOpacity, StyleSheet, Alert } from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "@/store/auth-store"
import { apiFetch } from "@/lib/api"
import { registerForPushNotificationsAsync } from "@/lib/push-notifications"

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  async function handleLogout() { await signOut(); router.replace("/(auth)/login") }

  async function enableNotifications() {
    if (!user) return
    const token = await registerForPushNotificationsAsync(user.id)
    if (token) Alert.alert("Notifications Enabled", "You will receive updates from Circle Pay.")
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <Text style={styles.name}>{user?.name || "User"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </div>
      <TouchableOpacity style={styles.option} onPress={() => router.push("/join/scan")}>
        <Text style={styles.optionText}>📷 Scan QR Code</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.option} onPress={enableNotifications}>
        <Text style={styles.optionText}>🔔 Enable Notifications</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </div>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 16 },
  name: { fontSize: 20, fontWeight: "600" }, email: { fontSize: 14, color: "#64748b", marginTop: 4 },
  option: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8 },
  optionText: { fontSize: 15, fontWeight: "500" },
  logoutButton: { backgroundColor: "#ef4444", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  logoutText: { color: "#fff", fontSize: 16, fontWeight: "600" },
})
