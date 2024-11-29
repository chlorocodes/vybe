import { Prisma } from '@prisma/client'

export type Story = Prisma.StoryGetPayload<{
  include: { words: true }
}>
