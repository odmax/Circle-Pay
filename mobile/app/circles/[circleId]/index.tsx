import { useEffect, useState } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native"
import { useLocalSearchParams, Link, useRouter } from "expo-router"
import { apiFetch } from "@/lib/api"
import { Screen, Header, Badge, StatCard, Card, ListItem } from "@/components/ui"

export default function CircleDetailScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>()
  const [circle, setCircle] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { apiFetch(`/circles/${circleId}`).then(setCircle).finally(() => setLoading(false)) }, [circleId])
  if (loading) return <Screen><ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 40 }} /></Screen>
  if (!circle) return <Screen><Text>Circle not found</Text></Screen>

  return (
    <Screen>
      <Header title={circle.name} subtitle={`${circle.type} · ${circle.memberCount || 0} members · ${circle.myRole}`} />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Badge label={circle.type} color="brand" />
        {circle.verification?.status === "VERIFIED" && <Badge label="Verified" color="emerald" />}
      </View>

      <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 8 }}>Quick Actions</Text>
      <View style={{ gap: 8, marginBottom: 16 }}>
        <Link href={`/circles/${circleId}/my-status`} asChild><TouchableOpacity style={styles.action}><Text style={styles.actionText}>👤 My Status</Text></TouchableOpacity></Link>
        <Link href={`/circles/${circleId}/payments`} asChild><TouchableOpacity style={styles.action}><Text style={styles.actionText}>💳 Payments</Text></TouchableOpacity></Link>
        <Link href={`/circles/${circleId}/projects`} asChild><TouchableOpacity style={styles.action}><Text style={styles.actionText}>📁 Projects</Text></TouchableOpacity></Link>
        <Link href={`/circles/${circleId}/operations`} asChild><TouchableOpacity style={styles.action}><Text style={styles.actionText}>⚙️ Operations</Text></TouchableOpacity></Link>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  action: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  actionText: { fontSize: 15, fontWeight: "500" },
})
