import { useEffect, useState } from "react"
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native"
import { useLocalSearchParams, Link } from "expo-router"
import { apiFetch } from "@/lib/api"
import { Screen, Header, Badge, ProgressBar, EmptyState } from "@/components/ui"

export default function ProjectsScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  async function load() { setRefreshing(true); apiFetch(`/circles/${circleId}/projects`).then(setProjects).finally(() => { setLoading(false); setRefreshing(false) }) }
  useEffect(() => { load() }, [circleId])
  if (loading) return <Screen><ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 40 }} /></Screen>

  const bc = (s: string) => s === "COMPLETED" ? "emerald" : s === "FUNDING" ? "amber" : s === "IN_PROGRESS" ? "brand" : "default"

  return (
    <Screen>
      <Header title="Projects" subtitle={`${projects.length} projects`} />
      {projects.length === 0 ? <EmptyState title="No projects" description="Create a project from the web app." /> : (
        <FlatList data={projects} keyExtractor={(item) => item.id} onRefresh={load} refreshing={refreshing}
          renderItem={({ item }) => {
            const progress = item.targetAmount && Number(item.targetAmount) > 0 ? Math.round((Number(item.currentAmount) / Number(item.targetAmount)) * 100) : 0
            return (
              <Link href={`/circles/${circleId}/projects/${item.id}`} asChild>
                <TouchableOpacity style={styles.item}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Badge label={item.status?.replace(/_/g, " ")} color={bc(item.status)} />
                  </View>
                  {item.targetAmount && <View style={{ marginTop: 8 }}><View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}><Text style={styles.money}>R{Number(item.currentAmount).toLocaleString()}</Text><Text style={{ color: "#64748b", fontSize: 12 }}>R{Number(item.targetAmount).toLocaleString()}</Text></View><ProgressBar progress={progress} /></View>}
                  <Text style={styles.itemSub}>{item.createdBy?.name} · {new Date(item.updatedAt).toLocaleDateString()}</Text>
                </TouchableOpacity>
              </Link>
            )
          }} />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  item: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8 },
  itemTitle: { fontSize: 15, fontWeight: "600" }, itemSub: { fontSize: 12, color: "#64748b", marginTop: 4 },
  money: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
})
