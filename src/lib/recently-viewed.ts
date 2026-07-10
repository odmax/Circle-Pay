"use client"

const STORAGE_KEY = "circlepay_recently_viewed"
const MAX_ITEMS = 10

export type RecentItem = { title: string; href: string; group: string; viewedAt: number }

function read(): RecentItem[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as RecentItem[] } catch { return [] }
}

function write(items: RecentItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
}

export function getRecentlyViewed(): RecentItem[] {
  return read().sort((a, b) => b.viewedAt - a.viewedAt).slice(0, MAX_ITEMS)
}

export function addRecentlyViewed(item: Omit<RecentItem, "viewedAt">) {
  const items = read().filter((i) => i.href !== item.href)
  items.unshift({ ...item, viewedAt: Date.now() })
  write(items.slice(0, 50))
}

export function clearRecentlyViewed() {
  write([])
}
