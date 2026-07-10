import { useEffect, useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from "react-native"
import { useRouter } from "expo-router"
import { CameraView, useCameraPermissions } from "expo-camera"

export default function QRScanScreen() {
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)

  useEffect(() => {
    if (!permission?.granted) requestPermission()
  }, [])

  function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned) return
    setScanned(true)

    let code = data.trim()
    // Parse different URL formats
    const joinMatch = code.match(/\/join\/([A-Za-z0-9]+)/) || code.match(/circlepay:\/\/join\/([A-Za-z0-9]+)/)
    if (joinMatch) code = joinMatch[1]

    const finalCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
    if (finalCode.length >= 6) {
      router.replace(`/join/${finalCode}`)
    } else {
      Alert.alert("Invalid QR", "This QR code does not contain a valid Circle Pay invite link.", [{ text: "OK", onPress: () => setScanned(false) }])
    }
  }

  if (!permission) return <View style={styles.container}><Text>Loading camera...</Text></View>

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera Access Needed</Text>
        <Text style={styles.sub}>Camera permission is required to scan QR codes. You can enable it in your device Settings.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}><Text style={styles.buttonText}>Allow Camera</Text></TouchableOpacity>
        <TouchableOpacity style={styles.outlineButton} onPress={() => router.push("/join")}><Text style={styles.outlineText}>Enter Code Manually</Text></TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={handleBarcodeScanned}>
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanText}>Point camera at a QR code</Text>
          <TouchableOpacity style={styles.manualButton} onPress={() => router.push("/join")}><Text style={styles.manualText}>Enter Code Manually</Text></TouchableOpacity>
        </View>
      </CameraView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  scanFrame: { width: 200, height: 200, borderWidth: 2, borderColor: "#16A34A", borderRadius: 16 },
  scanText: { color: "#fff", fontSize: 14, marginTop: 20, textAlign: "center" },
  manualButton: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, padding: 12, paddingHorizontal: 24, marginTop: 30 },
  manualText: { color: "#fff", fontSize: 14 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
  sub: { fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  button: { backgroundColor: "#16A34A", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 12 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  outlineButton: { borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  outlineText: { fontSize: 16, color: "#0f172a" },
})
