import * as ImagePicker from "expo-image-picker"
import { Alert, Platform } from "react-native"

export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== "granted") {
    Alert.alert("Permission Required", "Camera access is needed to capture proof of payment. You can enable it in your device Settings.")
    return false
  }
  return true
}

export async function pickProofImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
  })
  if (!result.canceled && result.assets.length > 0) {
    return result.assets[0]
  }
  return null
}

export async function takeProofPhoto() {
  const hasPermission = await requestCameraPermission()
  if (!hasPermission) return null

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.8,
  })
  if (!result.canceled && result.assets.length > 0) {
    return result.assets[0]
  }
  return null
}
