import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"

async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem("cp_token")
  return SecureStore.getItemAsync("cp_token")
}

async function setToken(token: string) {
  if (Platform.OS === "web") localStorage.setItem("cp_token", token)
  else await SecureStore.setItemAsync("cp_token", token)
}

export async function clearToken() {
  if (Platform.OS === "web") localStorage.removeItem("cp_token")
  else await SecureStore.deleteItemAsync("cp_token")
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as any) }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const r = await fetch(`${API_URL}/api/mobile${path}`, { ...options, headers })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || "Request failed")
  return data
}

export async function login(email: string, password: string) {
  const r = await fetch(`${API_URL}/api/mobile/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, _action: "login" }) })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || "Login failed")
  await setToken(data.token)
  return data.user
}

export async function register(name: string, email: string, password: string) {
  const r = await fetch(`${API_URL}/api/mobile/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, _action: "register" }) })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || "Registration failed")
  await setToken(data.token)
  return data.user
}

export async function getMe() {
  return apiFetch("/auth/me")
}
