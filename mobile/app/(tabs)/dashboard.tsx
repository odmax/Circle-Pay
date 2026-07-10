import { useEffect, useState } from "react"
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native"
import { useAuth } from "@/store/auth-store"
import { apiFetch } from "@/lib/api"

export default function DashboardScreen() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { apiFetch("/dashboard").then(setData).catch(() => {}).finally(() => setLoading(false)) }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#16A34A" /></View>
  if (!data) return <View style={styles.center}><Text>Unable to load dashboard</Text></View>

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>Hello, {user?.name?.split(" ")[0] || "User"}</Text>
      <View style={styles.grid}>
        <View style={styles.card}><Text style={styles.cardLabel}>My Circles</Text><Text style={styles.cardValue}>{data.stats?.totalCircles || 0}</Text></View>
        <View style={styles.card}><Text style={styles.cardLabel}>Total Pool</Text><Text style={styles.cardValue}>R{data.stats?.totalCirclePool?.toLocaleString() || 0}</Text></View>
        <View style={styles.card}><Text style={styles.cardLabel}>Active Goals</Text><Text style={styles.cardValue}>{data.stats?.activeGoals || 0}</Text></View>
        <View style={styles.card}><Text style={styles.cardLabel}>Pending</Text><Text style={styles.cardValue}>R{data.stats?.pendingContributions?.toLocaleString() || 0}</Text></View>
      </View>
      <Text style={styles.sectionTitle}>My Circles</Text>
      {(data.circles || []).slice(0, 3).map((c: any) => (
        <View key={c.id} style={styles.listItem}><Text style={styles.listItemTitle}>{c.name}</Text><Text style={styles.listItemSub}>{c.type} · {c.memberCount || c._count?.members} members</Text></View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  greeting: { fontSize: 24, fontWeight: "700", color: "#0f172a", marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, width: "47%", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardLabel: { fontSize: 12, color: "#64748b" }, cardValue: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8, color: "#0f172a" },
  listItem: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8 },
  listItemTitle: { fontSize: 16, fontWeight: "600" }, listItemSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
})
