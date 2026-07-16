import { useEffect, useState } from "react"
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, Alert } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { Screen, Header, Badge, EmptyState } from "@/components/ui"
import { pickProofImage, takeProofPhoto } from "@/lib/image-picker"
import { apiFetch, getToken } from "@/lib/api"

export default function PaymentsScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>()
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [proofInput, setProofInput] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  async function load() { setRefreshing(true); apiFetch(`/circles/${circleId}/payments`).then(setPayments).finally(() => { setLoading(false); setRefreshing(false) }) }
  useEffect(() => { load() }, [circleId])

  async function uploadAndSubmit(id: string, ref: string) {
    const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"

    // Try photo upload
    Alert.alert("Upload Proof", "Choose a method", [
      { text: "Take Photo", onPress: async () => { const asset = await takeProofPhoto(); if (asset) await uploadFile(asset.uri, asset.mimeType || "image/jpeg", id) } },
      { text: "Choose from Gallery", onPress: async () => { const asset = await pickProofImage(); if (asset) await uploadFile(asset.uri, asset.mimeType || "image/jpeg", id) } },
      { text: "Text Reference Only", onPress: () => submitReferenceOnly(id, ref) },
      { text: "Cancel", style: "cancel" },
    ])
  }

  async function uploadFile(uri: string, mimeType: string, paymentIntentId: string) {
    setUploading((p) => ({ ...p, [paymentIntentId]: true }))
    try {
      const formData = new FormData()
      formData.append("file", { uri, type: mimeType, name: `proof-${Date.now()}.jpg` } as any)
      formData.append("paymentIntentId", paymentIntentId)
      formData.append("circleId", circleId)

      const token = await getToken()

      const r = await fetch(`${process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"}/api/mobile/uploads/proof`, {
        method: "POST", body: formData, headers: { "Authorization": `Bearer ${token}` },
      })
      const d = await r.json()
      if (!r.ok) { Alert.alert("Upload Failed", d.error || "Could not upload proof") }
      else { Alert.alert("Proof Submitted", "Your proof of payment has been submitted for review."); load() }
    } catch (e) { Alert.alert("Error", "Failed to upload proof") }
    setUploading((p) => ({ ...p, [paymentIntentId]: false }))
  }

  async function submitReferenceOnly(id: string, ref: string) {
    if (!ref) return
    const token = await getToken()
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) headers["Authorization"] = `Bearer ${token}`
    await fetch(`${process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"}/api/mobile/uploads/proof`, {
      method: "POST", headers,
      body: JSON.stringify({ proofReference: ref, paymentIntentId: id }),
    })
    setProofInput((p) => ({ ...p, [id]: "" })); load()
  }

  if (loading) return <Screen><ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 40 }} /></Screen>

  const bc = (s: string) => s === "PENDING" ? "amber" : s === "PROOF_SUBMITTED" ? "brand" : s === "CONFIRMED" ? "emerald" : s === "OVERDUE" ? "red" : "default"

  return (
    <Screen>
      <Header title="Payments" subtitle="Track and submit proof of payment" />
      {payments.length === 0 ? <EmptyState title="No payments" description="Generate dues from the web app." /> : (
        <FlatList data={payments} keyExtractor={(item) => item.id} onRefresh={load} refreshing={refreshing}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}><Text style={styles.itemTitle}>{item.type?.replace(/_/g, " ")}</Text><Text style={styles.itemSub}>R{Number(item.amount).toLocaleString()} · Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "—"}</Text></View>
                <Badge label={item.status?.replace(/_/g, " ")} color={bc(item.status)} />
              </View>
              {item.proofReference && <Text style={styles.proofRef}>Ref: {item.proofReference}</Text>}
              {(item.status === "PENDING" || item.status === "OVERDUE") && (
                <View style={styles.proofRow}>
                  <TextInput style={styles.proofInput} placeholder="Reference..." value={proofInput[item.id] || ""} onChangeText={(t) => setProofInput((p) => ({ ...p, [item.id]: t }))} />
                  <TouchableOpacity style={styles.proofBtn} onPress={() => uploadAndSubmit(item.id, proofInput[item.id] || "")} disabled={uploading[item.id]}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>{uploading[item.id] ? "..." : "Upload"}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )} />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  item: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8 },
  itemTitle: { fontSize: 15, fontWeight: "600" }, itemSub: { fontSize: 13, color: "#64748b", marginTop: 4 },
  proofRef: { fontSize: 12, color: "#16A34A", marginTop: 4 },
  proofRow: { flexDirection: "row", marginTop: 8, gap: 8 },
  proofInput: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 8, fontSize: 13, backgroundColor: "#f8fafc" },
  proofBtn: { backgroundColor: "#16A34A", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, justifyContent: "center" },
})
