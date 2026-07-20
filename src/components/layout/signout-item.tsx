"use client"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

export function SignOutItem() {
  return (
    <DropdownMenuItem
      onClick={() => { window.location.href = "/api/auth/logout" }}
      className="text-destructive cursor-pointer"
    >
      Sign Out
    </DropdownMenuItem>
  )
}
