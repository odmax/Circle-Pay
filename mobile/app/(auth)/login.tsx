import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native"
import { Link, useRouter } from "expo-router"
import { useAuth } from "@/store/auth-store"

export default function LoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const { signIn, loading, error } = useAuth()
  const router = useRouter()

  async function handleLogin() {
    if (!email || !password) return
    await signIn(email, password)
    if (!error) router.replace("/(tabs)/dashboard")
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.brand}>Circle Pay</Text>
        <Text style={styles.title}>Welcome back</Text>
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>
        <Link href="/(auth)/register" style={styles.link}>Don't have an account? Sign up</Link>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc", padding: 20 },
  card: { width: "100%", maxWidth: 360, backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  brand: { fontSize: 28, fontWeight: "800", color: "#16A34A", textAlign: "center", marginBottom: 4 },
  title: { fontSize: 16, color: "#64748b", textAlign: "center", marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 12, backgroundColor: "#f8fafc" },
  button: { backgroundColor: "#16A34A", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#ef4444", fontSize: 14, marginBottom: 8, textAlign: "center" },
  link: { color: "#16A34A", textAlign: "center", marginTop: 16, fontSize: 14 },
})
