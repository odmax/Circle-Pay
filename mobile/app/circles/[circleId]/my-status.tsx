import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { apiFetch } from "@/lib/api"
import { Screen, Header, StatCard, Card, Badge, Button } from "@/components/ui"

export default function MyStatusScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() { setRefreshing(true); apiFetch(`/circles/${circleId}/my-status`).then(setData).finally(() => { setLoading(false); setRefreshing(false) }) }
  useEffect(() => { load() }, [circleId])
  if (loading) return <Screen><ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 40 }} /></Screen>

  const s = data
  return (
    <Screen scroll onRefresh={load} refreshing={refreshing}>
      <Header title="My Status" subtitle={`${s?.circle?.name} · ${s?.member?.role}`} />

      {s?.warnings?.length > 0 && <Card style={{ backgroundColor: "#fffbeb", borderColor: "#f59e0b", borderWidth: 1, marginBottom: 16 }}><Text style={{ color: "#92400e", fontWeight: "600", marginBottom: 4 }}>⚠️ Attention</Text>{s.warnings.map((w: string, i: number) => <Text key={i} style={{ color: "#92400e", fontSize: 13 }}>{w}</Text>)}</Card>}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <StatCard label="My Contributions" value={`R${(s?.contributions?.total || 0).toLocaleString()}`} sub={`R${(s?.contributions?.thisMonth || 0).toLocaleString()} this month`} />
        <StatCard label="Owed by Me" value={`R${(s?.balances?.owedByMe || 0).toLocaleString()}`} />
        <StatCard label="Owed to Me" value={`R${(s?.balances?.owedToMe || 0).toLocaleString()}`} />
        <StatCard label="Due Items" value={String((s?.payments?.pending || 0) + (s?.payments?.overdue || 0))} sub={s?.payments?.overdue > 0 ? `${s.payments.overdue} overdue` : "All clear"} />
      </View>

      {s?.nextActions?.length > 0 && (
        <Card><Text style={{ fontWeight: "600", marginBottom: 8 }}>Next Actions</Text>
          {s.nextActions.map((a: any, i: number) => <Button key={i} label={a.label} variant="outline" />)}
        </Card>
      )}
    </Screen>
  )
}
