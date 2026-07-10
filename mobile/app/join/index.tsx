import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native"
import { useRouter } from "expo-router"

export default function JoinScreen() {
  const [code, setCode] = useState("")
  const router = useRouter()
  function handleJoin() { if (code.trim()) router.push(`/join/${code.trim().toUpperCase()}`) }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a Circle</Text>
      <TextInput style={styles.input} placeholder="Enter invite code" value={code} onChangeText={setCode} autoCapitalize="characters" />
      <TouchableOpacity style={styles.button} onPress={handleJoin}><Text style={styles.buttonText}>Find Circle</Text></TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 20, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 16, fontSize: 20, textAlign: "center", letterSpacing: 4, backgroundColor: "#fff" },
  button: { backgroundColor: "#16A34A", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
})
