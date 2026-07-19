"use client"

import { useMemo } from "react"
import type { CirclePermission } from "@/lib/permissions/circlePermissions"

export function useCirclePermissions(permissions: CirclePermission[]) {
  return useMemo(() => ({
    permissions,
    can: (permission: CirclePermission) => permissions.includes(permission),
    canAny: (...perms: CirclePermission[]) => perms.some(p => permissions.includes(p)),
    canAll: (...perms: CirclePermission[]) => perms.every(p => permissions.includes(p)),
  }), [permissions])
}
