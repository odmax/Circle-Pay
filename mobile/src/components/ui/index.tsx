import React from "react"
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

export function Screen({ children, scroll, onRefresh, refreshing }: { children: React.ReactNode; scroll?: boolean; onRefresh?: () => void; refreshing?: boolean }) {
  const content = scroll ? <ScrollView refreshControl={onRefresh ? <RefreshControl refreshing={refreshing || false} onRefresh={onRefresh} /> : undefined}>{children}</ScrollView> : <>{children}</>
  return <SafeAreaView style={styles.container}><View style={styles.inner}>{content}</View></SafeAreaView>
}

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={styles.header}><Text style={styles.headerTitle}>{title}</Text>{subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}</View>
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <View style={styles.statCard}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text>{sub ? <Text style={styles.statSub}>{sub}</Text> : null}</View>
}

export function Badge({ label, color = "default" }: { label: string; color?: string }) {
  const bg = color === "emerald" ? "#ecfdf5" : color === "amber" ? "#fffbeb" : color === "red" ? "#fef2f2" : color === "brand" ? "#f0fdf4" : "#f8fafc"
  const tc = color === "emerald" ? "#047857" : color === "amber" ? "#b45309" : color === "red" ? "#dc2626" : color === "brand" ? "#166534" : "#64748b"
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={[styles.badgeText, { color: tc }]}>{label}</Text></View>
}

export function Button({ label, onPress, variant = "primary", disabled }: { label: string; onPress?: () => void; variant?: "primary" | "outline"; disabled?: boolean }) {
  const isPrimary = variant === "primary"
  return (
    <TouchableOpacity style={[styles.button, isPrimary ? styles.btnPrimary : styles.btnOutline, disabled && styles.btnDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.btnText, isPrimary ? styles.btnTextPrimary : styles.btnTextOutline]}>{label}</Text>
    </TouchableOpacity>
  )
}

export function EmptyState({ icon, title, description }: { icon?: string; title: string; description?: string }) {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>{icon || "📭"}</Text><Text style={styles.emptyTitle}>{title}</Text>{description ? <Text style={styles.emptyDesc}>{description}</Text> : null}</View>
}

export function LoadingState() {
  return <View style={styles.center}><ActivityIndicator size="large" color="#16A34A" /></View>
}

export function ListItem({ title, subtitle, right, onPress }: { title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.listItem} onPress={onPress} disabled={!onPress}>
      <View style={{ flex: 1 }}><Text style={styles.listItemTitle}>{title}</Text>{subtitle ? <Text style={styles.listItemSub}>{subtitle}</Text> : null}</View>
      {right}
    </TouchableOpacity>
  )
}

export function ProgressBar({ progress, color = "#16A34A" }: { progress: number; color?: string }) {
  return <View style={styles.progressBg}><View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: color }]} /></View>
}

export function MoneyText({ value, currency = "R" }: { value: number; currency?: string }) {
  return <Text style={styles.money}>{currency}{value.toLocaleString()}</Text>
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  inner: { flex: 1, padding: 16 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#0f172a" },
  headerSub: { fontSize: 14, color: "#64748b", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, marginBottom: 12 },
  statCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, flex: 1, minWidth: "45%", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginTop: 4 },
  statSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  btnPrimary: { backgroundColor: "#16A34A" },
  btnOutline: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 15, fontWeight: "600" },
  btnTextPrimary: { color: "#fff" },
  btnTextOutline: { color: "#0f172a" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  emptyDesc: { fontSize: 13, color: "#64748b", marginTop: 4, textAlign: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listItem: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: "row", alignItems: "center" },
  listItemTitle: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  listItemSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  progressBg: { height: 8, borderRadius: 4, backgroundColor: "#e2e8f0", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  money: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
})
