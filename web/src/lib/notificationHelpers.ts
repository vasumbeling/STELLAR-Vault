import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export type NotificationVariant =
  | 'success'
  | 'info'
  | 'warning'
  | 'error'
  | 'action_required'

export async function createNotification(params: {
  pubkey: string
  message: string
  vaultId?: string | null
  variant?: NotificationVariant
  meta?: Record<string, unknown> | null
}) {
  return prisma.notification.create({
    data: {
      pubkey: params.pubkey,
      message: params.message,
      vaultId: params.vaultId ?? null,
      variant: params.variant ?? 'info',
      meta: params.meta ? (params.meta as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  })
}

export async function notifyVaultMembers(params: {
  vaultId: string
  message: string
  variant?: NotificationVariant
  meta?: Record<string, unknown> | null
  excludePubkeys?: string[]
}) {
  const members = await prisma.vaultMember.findMany({
    where: { vaultId: params.vaultId },
    select: { pubkey: true },
  })

  const recipients = members
    .map((member) => member.pubkey)
    .filter((pubkey) => !params.excludePubkeys?.includes(pubkey))

  if (recipients.length === 0) return []

  const notifications = recipients.map((pubkey) => ({
    pubkey,
    message: params.message,
    vaultId: params.vaultId,
    variant: params.variant ?? 'info',
    meta: params.meta ? (params.meta as Prisma.InputJsonValue) : Prisma.JsonNull,
  }))

  await prisma.notification.createMany({
    data: notifications,
  })

  return notifications
}