import {
  Message,
  APIEmbed,
  GuildTextBasedChannel,
  TextBasedChannel,
  TextChannel
} from 'discord.js'
import { googleService } from '../services/google'

type TranslatedMessage = Pick<Message, 'author' | 'content'>

export async function translate(message: Message, args: string[] = []) {
  if (message.content.startsWith('!translate~')) {
    return multiTranslate(message)
  }

  let untranslatedText = args.join(' ').trim()
  if (!untranslatedText) {
    if (message.reference) {
      const reference = await message.fetchReference()
      untranslatedText = reference.content
    } else {
      const { id, channel } = message
      const [previousMessage] = await getMessages(channel, 1, id)
      untranslatedText = previousMessage.content
    }
  }

  const translation = await googleService.translate(untranslatedText)
  message.reply(`Translation: ${translation}`)
}

async function multiTranslate(message: Message) {
  const count = Number(message.content.split('~')[1])
  if (!count || Number.isNaN(count)) {
    return message.reply('Invalid usage')
  }

  const translationLimit = 15
  if (count > translationLimit) {
    return message.reply(
      `You can only translate a maximum of ${translationLimit} messages at a time`
    )
  }

  let initialMessage = message.id
  if (message.reference) {
    const reference = await message.fetchReference()
    initialMessage = reference.id
  }

  const channel = message.channel
  const untranslatedMessages = await getMessages(channel, count, initialMessage)

  const translatedMessages: TranslatedMessage[] = await Promise.all(
    untranslatedMessages.map(async (message) => ({
      author: message.author,
      content: await googleService.translate(message.content)
    }))
  )

  const messageEmbed = createEmbed(translatedMessages)
  ;(message.channel as TextChannel).send({ embeds: [messageEmbed] })
}

async function getMessages(
  channel: GuildTextBasedChannel | TextBasedChannel,
  count: number,
  initialMessageId: string
) {
  const collection = await channel.messages.fetch({
    limit: count,
    ...(initialMessageId && {
      before: initialMessageId
    })
  })

  const messages = [...collection.values()].reverse()
  const untranslatedMessages = messages.filter(
    (message) =>
      message.content.trim() !== '' && !message.content.startsWith('!translate')
  )

  return untranslatedMessages
}

function createEmbed(translatedMessages: TranslatedMessage[]) {
  const embed: APIEmbed = {
    title: 'Translations',
    color: 0xa3f55c,
    fields: translatedMessages.map((message) => ({
      name: message.author.username,
      value: message.content
    }))
  }
  return embed
}
