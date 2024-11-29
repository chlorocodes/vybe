import { Message, TextChannel } from 'discord.js'
import { db } from './database'
import { delay } from '../utils/delay'
import { settings } from '../vybe'
import { Story } from '../types/model'

const articles = ['!', '?', ':', ';', '-', '–', '.', ',']
const sentenceTerminators = ['.', '?', '!']

export class OneWordStoryService {
  static shared = new OneWordStoryService()

  stateId = ''
  storyId = ''
  lastAuthor = ''
  lastWord = ''

  constructor() {
    this.initialize()
  }

  async onWord(message: Message) {
    const isValid = await this.validate(message)

    if (!isValid) {
      return
    }

    const word = message.content
    await this.addWord(word, message)
    message.react('✅')

    const lastCharacter = word.slice(-1)
    if (sentenceTerminators.includes(lastCharacter)) {
      this.displayStory(message)
    }
  }

  async reset(message: Message) {
    await this.deleteCurrentStory()
    this.storyId = await this.createNextStory()
    this.lastAuthor = ''
    this.lastWord = ''
    message.reply('Story has been reset')
  }

  async end(message: Message, storyName: string = 'Graype Story') {
    const nextStoryId = await this.createNextStory()
    await db.$transaction([
      db.story.update({
        where: { id: this.storyId },
        data: { isComplete: true, name: storyName }
      }),
      db.state.update({
        where: { id: this.stateId },
        data: {
          currentStoryId: nextStoryId,
          lastAuthorId: '',
          lastWord: ''
        }
      })
    ])
    this.storyId = nextStoryId
    this.lastAuthor = ''
    this.lastWord = ''
    await this.displayStory(
      message,
      'New story started! The previous one has been saved.'
    )
  }

  async displayStory(message: Message, title = 'Current Story:') {
    const story = await db.story.findUnique({
      where: {
        id: this.storyId
      },
      include: {
        words: { orderBy: { createdAt: 'asc' } }
      }
    })

    if (!story) {
      return
    }

    const words = story.words.map(({ word }) => word)

    const embed = {
      title,
      description: words.join(' '),
      color: settings.color
    }

    ;(message.channel as TextChannel).send({ embeds: [embed] })
  }

  private async initialize() {
    const state = await db.state.findFirst()

    if (state?.currentStoryId) {
      const story = await this.getStory(state.currentStoryId)
      this.storyId = story.id
      this.stateId = state.id
      this.lastAuthor = state.lastAuthorId
      this.lastWord = state.lastWord
    } else {
      await db.state.deleteMany()
      const storyId = await this.createNextStory()
      const { id: stateId } = await db.state.create({
        data: {
          currentStoryId: storyId
        }
      })
      this.stateId = stateId
      this.storyId = storyId
    }
  }

  private async addWord(word: string, message: Message) {
    const wordToAdd = sentenceTerminators.includes(word) ? word : ` ${word}`
    const { id: userId, username } = message.author

    await db.$transaction([
      db.author.upsert({
        where: { id: userId },
        create: {
          id: userId,
          username,
          avatar: message.author.displayAvatarURL()
        },
        update: {}
      }),
      db.word.create({
        data: {
          word: wordToAdd,
          storyId: this.storyId,
          authorId: userId,
          discordMessageId: message.id
        }
      }),
      db.state.update({
        where: { id: this.stateId },
        data: { lastAuthorId: userId, lastWord: wordToAdd }
      })
    ])

    this.lastAuthor = userId
    this.lastWord = wordToAdd
  }

  private async getStory(id: string): Promise<Story> {
    const story = await db.story.findUnique({
      where: { id },
      include: { words: true }
    })
    return story as Story
  }

  private async createNextStory(): Promise<string> {
    const { id: storyId } = await db.story.create({
      data: {}
    })
    return storyId
  }

  private async deleteCurrentStory() {
    await db.story.delete({
      where: { id: this.storyId }
    })
  }
  private async validate(message: Message) {
    const isValidWord = await this.validateWord(message)
    if (!isValidWord) {
      return false
    }

    const isValidAuthor = await this.validateAuthor(message)
    if (!isValidAuthor) {
      return false
    }

    return true
  }

  private async validateWord(message: Message) {
    const input = message.cleanContent.trim()
    const words = input.split(' ')

    if (words.length > 2) {
      this.sendErrorMessage(message, 'Please send 1 word at a time')
      return false
    }

    if (words.length === 2) {
      const [first, second] = words
      console.log({ first, second })
      if (!articles.includes(first) && !articles.includes(second)) {
        this.sendErrorMessage(message, 'Please send 1 word at a time')
        return false
      }
    }

    if (input === this.lastWord) {
      this.sendErrorMessage(message, "You can't repeat the same word")
      return false
    }

    return true
  }

  private validateAuthor(message: Message) {
    if (message.author.id === this.lastAuthor) {
      this.sendErrorMessage(
        message,
        'The same person cannot send a word twice in a row'
      )
      return false
    }

    return true
  }

  private async sendErrorMessage(message: Message, error: string) {
    await message.delete()
    const reply = await (message.channel as TextChannel).send(error)
    await delay()
    await reply.delete()
  }
}
