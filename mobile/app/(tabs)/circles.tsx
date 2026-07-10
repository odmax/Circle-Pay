import { useEffect, useState } from "react"
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native"
import { Link } from "expo-router"
import { apiFetch } from "@/lib/api"

export default function CirclesScreen() {
  const [circles, setCircles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { apiFetch("/circles").then(setCircles).finally(() => setLoading(false)) }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#16A34A" /></View>

  return (
    <View style={styles.container}>
      <FlatList data={circles} keyExtractor={(item) => item.id} renderItem={({ item }) => (
        <Link href={`/circles/${item.id}`} asChild><TouchableOpacity style={styles.item}><Text style={styles.itemTitle}>{item.name}</Text><Text style={styles.itemSub}>{item.type} · {item.memberCount} members · {item.myRole}</Text></TouchableOpacity></Link>
      )} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 }, center: { flex: 1, justifyContent: "center", alignItems: "center" },
  item: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8 },
  itemTitle: { fontSize: 16, fontWeight: "600" }, itemSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
})
