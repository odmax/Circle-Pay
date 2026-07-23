import { redirect } from "next/navigation"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ circleId: string; projectId: string }>
}) {
  const { circleId, projectId } = await params
  redirect(`/circles/${circleId}/projects/${projectId}/overview`)
}
