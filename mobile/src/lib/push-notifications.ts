import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { Platform, Alert } from "react-native"
import { useRouter } from "expo-router"
import { apiFetch } from "./api"

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
})

export async function registerForPushNotificationsAsync(userId: string) {
  if (!Device.isDevice) return null

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== "granted") {
    Alert.alert("Notifications Disabled", "Enable notifications in your device Settings to receive updates.")
    return null
  }

  const expoPushToken = await Notifications.getExpoPushTokenAsync()
  const deviceId = `${Platform.OS}-${Math.random().toString(36).slice(2, 10)}`

  try {
    await apiFetch("/push-token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: expoPushToken.data, platform: Platform.OS, deviceId }),
    })
  } catch {}

  return expoPushToken.data
}

// Deep link handler — call at app startup
export function useNotificationResponse(router: ReturnType<typeof useRouter>) {
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data
    if (data?.href) {
      router.push(data.href as string)
    } else if (data?.circleId) {
      router.push(`/circles/${data.circleId}`)
    } else {
      router.push("/(tabs)/notifications")
    }
  })
}
