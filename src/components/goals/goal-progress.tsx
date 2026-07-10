interface GoalProgressProps {
  current: number
  target: number
  size?: "sm" | "md" | "lg"
}

export function GoalProgress({
  current,
  target,
  size = "md",
}: GoalProgressProps) {
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  const heights = { sm: "h-1.5", md: "h-2.5", lg: "h-4" }
  const textSizes = { sm: "text-[10px]", md: "text-xs", lg: "text-sm" }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={`${textSizes[size]} font-medium text-muted-foreground`}>
          {percent}% saved
        </span>
        {size !== "sm" && (
          <span className={`${textSizes[size]} text-muted-foreground`}>
            {current.toLocaleString()} / {target.toLocaleString()}
          </span>
        )}
      </div>
      <div className={`${heights[size]} w-full overflow-hidden rounded-full bg-muted`}>
        <div
          className={`${heights[size]} rounded-full transition-all duration-500 ${
            percent >= 100 ? "bg-emerald-500" : "bg-brand"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
