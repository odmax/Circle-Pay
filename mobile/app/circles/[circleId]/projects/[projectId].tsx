import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { apiFetch } from "@/lib/api"
import { Screen, Header, StatCard, Card, ProgressBar, Badge } from "@/components/ui"

export default function ProjectDetailScreen() {
  const { circleId, projectId } = useLocalSearchParams<{ circleId: string; projectId: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { apiFetch(`/circles/${circleId}/projects/${projectId}`).then(setData).finally(() => setLoading(false)) }, [circleId, projectId])
  if (loading) return <Screen><ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 40 }} /></Screen>
  if (!data) return <Screen><Text>Project not found</Text></Screen>

  const progress = data.targetAmount && Number(data.targetAmount) > 0 ? Math.round((Number(data.currentAmount) / Number(data.targetAmount)) * 100) : 0
  const roi = data.roi || {}

  return (
    <Screen scroll>
      <Header title={data.name} subtitle={`Status: ${data.status?.replace(/_/g, " ")}`} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <StatCard label="Target" value={`R${Number(data.targetAmount || 0).toLocaleString()}`} />
        <StatCard label="Raised" value={`R${Number(data.currentAmount || 0).toLocaleString()}`} sub={`${progress}%`} />
      </View>
      {data.targetAmount && <Card><ProgressBar progress={progress} /></Card>}
      {roi.netProfit !== undefined && (
        <Card><Text style={{ fontWeight: "600", marginBottom: 8 }}>ROI Summary</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}><Text style={{ color: "#64748b" }}>Net Profit</Text><Text style={{ fontWeight: "600", color: roi.netProfit >= 0 ? "#047857" : "#dc2626" }}>R{Number(roi.netProfit || 0).toLocaleString()}</Text></View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: "#64748b" }}>ROI</Text><Text style={{ fontWeight: "600" }}>{roi.roi || 0}%</Text></View>
        </Card>
      )}
      {data.description ? <Card><Text>{data.description}</Text></Card> : null}
    </Screen>
  )
}
