import { create } from "zustand"
import { login, register, getMe, clearToken } from "@/lib/api"

interface User { id: string; name: string; email: string; currency: string; image?: string }

interface AuthState {
  user: User | null; loading: boolean; error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null, loading: true, error: null,
  signIn: async (email, password) => { set({ loading: true, error: null }); try { const user = await login(email, password); set({ user, loading: false }) } catch (e) { set({ error: (e as Error).message, loading: false }) } },
  signUp: async (name, email, password) => { set({ loading: true, error: null }); try { const user = await register(name, email, password); set({ user, loading: false }) } catch (e) { set({ error: (e as Error).message, loading: false }) } },
  signOut: async () => {
    try { await fetch(`${process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"}/api/mobile/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json" } }).catch(() => {}) } catch {}
    await clearToken(); set({ user: null })
  },
  checkAuth: async () => { try { const user = await getMe(); set({ user, loading: false }) } catch { set({ loading: false }) } },
}))
