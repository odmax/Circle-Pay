import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native"
import { apiFetch } from "@/lib/api"

export default function PortfolioScreen() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { apiFetch("/portfolio").then(setData).finally(() => setLoading(false)) }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#16A34A" /></View>
  if (!data) return <View style={styles.center}><Text>No portfolio data</Text></View>

  return (
    <ScrollView style={styles.container}>
      <View style={styles.grid}>
        <View style={styles.card}><Text style={styles.cardLabel}>Total Invested</Text><Text style={styles.cardValue}>R{(data.totalInvested || 0).toLocaleString()}</Text></View>
        <View style={styles.card}><Text style={styles.cardLabel}>Projects</Text><Text style={styles.cardValue}>{(data.contributions || []).length}</Text></View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 }, center: { flex: 1, justifyContent: "center", alignItems: "center" },
  grid: { flexDirection: "row", gap: 12 }, card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, flex: 1 }, cardLabel: { fontSize: 12, color: "#64748b" }, cardValue: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginTop: 4 },
})
