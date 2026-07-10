import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { apiFetch } from "@/lib/api"
import { Screen, Header, StatCard, Card, Badge } from "@/components/ui"

export default function OperationsScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { apiFetch(`/circles/${circleId}`).then(setData).finally(() => setLoading(false)) }, [circleId])
  if (loading) return <Screen><ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 40 }} /></Screen>
  if (!data) return <Screen><Text>Circle not found</Text></Screen>

  return (
    <Screen scroll>
      <Header title="Operations" subtitle={`${data.name} · ${data.type}`} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <StatCard label="Members" value={String(data.memberCount || data._count?.members || 0)} />
        <StatCard label="Type" value={data.type} />
      </View>
      <Card><Text style={{ color: "#64748b", textAlign: "center" }}>Full operations dashboard is available on the web app for detailed workflow tracking, automations, and analytics.</Text></Card>
    </Screen>
  )
}
