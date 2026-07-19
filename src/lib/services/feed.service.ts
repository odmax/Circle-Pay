import { prisma } from "@/lib/prisma"
import type { FeedPostType } from "@/generated/prisma"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

async function validateMember(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!m) throw new Error("Not a member")
}

export async function getCircleFeed(circleId: string, limit = 20, cursor?: string) {
  const where: Record<string, unknown> = { circleId, deletedAt: null }
  if (cursor) {
    const cursorPost = await prisma.feedPost.findUnique({ where: { id: cursor }, select: { createdAt: true, isPinned: true } })
    if (cursorPost) {
      where.OR = [
        { isPinned: true, createdAt: { lt: cursorPost.createdAt } },
        { isPinned: false, createdAt: { lt: cursorPost.createdAt } },
      ]
    }
  }

  const posts = await prisma.feedPost.findMany({
    where,
    include: {
      author: { select: { id: true, name: true, email: true, image: true } },
      _count: { select: { comments: true, reactions: true } },
      reactions: { select: { emoji: true, userId: true } },
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
  })

  const hasMore = posts.length > limit
  if (hasMore) posts.pop()

  return {
    posts,
    nextCursor: hasMore ? posts[posts.length - 1]?.id : null,
    hasMore,
  }
}

export async function createPost(circleId: string, userId: string, data: { content: string; title?: string; type?: string }) {
  await validateMember(circleId, userId)
  return prisma.feedPost.create({
    data: { circleId, authorId: userId, content: data.content, title: data.title || null, type: (data.type || "UPDATE") as FeedPostType },
    include: { author: { select: { id: true, name: true, email: true, image: true } }, _count: { select: { comments: true, reactions: true } } },
  })
}

export async function createSystemPost(circleId: string, data: { type: string; content: string; title?: string }) {
  try {
    return await prisma.feedPost.create({
      data: { circleId, authorId: "system", type: (data.type as FeedPostType) || "SYSTEM", content: data.content, title: data.title || null },
    })
  } catch {}
}

export async function createComment(postId: string, userId: string, content: string) {
  const post = await prisma.feedPost.findUnique({ where: { id: postId } })
  if (!post) throw new Error("Post not found")
  await validateMember(post.circleId, userId)
  return prisma.feedComment.create({ data: { postId, userId, content } })
}

export async function toggleReaction(postId: string, userId: string, emoji: string) {
  const existing = await prisma.feedReaction.findUnique({ where: { postId_userId_emoji: { postId, userId, emoji } } })
  if (existing) {
    await prisma.feedReaction.delete({ where: { id: existing.id } })
    return { added: false }
  }
  await prisma.feedReaction.create({ data: { postId, userId, emoji } })
  return { added: true }
}

export async function deletePost(postId: string, userId: string, circleId: string) {
  const canDelete = await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.FEED_DELETE })
  if (!canDelete) throw new Error("Forbidden")
  return prisma.feedPost.update({ where: { id: postId }, data: { deletedAt: new Date() } })
}

export async function pinPost(postId: string, userId: string, circleId: string) {
  const canPin = await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.FEED_PIN })
  if (!canPin) throw new Error("Forbidden")
  return prisma.feedPost.update({ where: { id: postId }, data: { isPinned: true } })
}
