import { useEffect } from "react"
import { Stack } from "expo-router"
import { useAuth } from "@/store/auth-store"

export default function RootLayout() {
  const { checkAuth, loading } = useAuth()

  useEffect(() => { checkAuth() }, [])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="circles/[circleId]/index" options={{ headerShown: true, title: "Circle" }} />
      <Stack.Screen name="join/index" options={{ headerShown: true, title: "Join Circle" }} />
      <Stack.Screen name="join/[inviteCode]" options={{ headerShown: true, title: "Join" }} />
    </Stack>
  )
}
