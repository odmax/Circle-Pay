import { useEffect, useState } from "react"
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native"
import { apiFetch } from "@/lib/api"

export default function NotificationsScreen() {
  const [data, setData] = useState<any>({ notifications: [], unreadCount: 0 })
  const [loading, setLoading] = useState(true)
  useEffect(() => { apiFetch("/notifications").then(setData).finally(() => setLoading(false)) }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#16A34A" /></View>

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{data.unreadCount} unread</Text>
      <FlatList data={data.notifications} keyExtractor={(item: any) => item.id} renderItem={({ item }) => (
        <View style={[styles.item, !item.isRead && styles.unread]}>
          <Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemSub}>{item.message}</Text>
        </View>
      )} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 }, center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { fontSize: 14, color: "#64748b", marginBottom: 8 },
  item: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8 },
  unread: { borderLeftWidth: 3, borderLeftColor: "#16A34A" },
  itemTitle: { fontSize: 15, fontWeight: "600" }, itemSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
})
