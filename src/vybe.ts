import { Client, GatewayIntentBits, Message, TextChannel } from 'discord.js'
import { OneWordStoryService } from './services/one-word-stories'
import { translate } from './commands/translate'

export const settings = {
  id: process.env.VYBE_USER_ID as string,
  roleId: process.env.VYBE_ROLE_ID as string,
  adminRoles: [
    '1024519285357416478',
    '1036774701046960218',
    '1312122841428398181'
  ],
  name: 'Vybe',
  color: 0x9266cc,
  token: process.env.VYBE_TOKEN,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  commands: ['!story', '!end', '!reset', '!translate'],
  adminCommands: ['!on', '!off'],
  adminPrefix: '!!'
}

export class Vybe {
  private settings = settings
  private isOn = true
  private client: Client = new Client({ intents: this.settings.intents })
  private stories = OneWordStoryService.shared
  private translator = OneWordStoryService.shared

  private setupEventListeners() {
    this.client.once('ready', this.onReady.bind(this))
    this.client.on('messageCreate', this.onMessage.bind(this))
  }

  private onReady(client: Client<true>) {
    console.log(`Ready! Logged in as ${client.user.tag}`)
  }

  private async onMessage(message: Message) {
    const storyChannelId =
      process.env.NODE_ENV === 'development'
        ? process.env.DEBUG_STORY_CHANNEL_ID
        : process.env.ONE_WORD_STORY_CHANNEL_ID

    if (message.author.bot) {
      return
    }

    const allCommands = [
      ...this.settings.commands,
      ...this.settings.adminCommands
    ]

    if (allCommands.some((cmd) => message.cleanContent.startsWith(cmd))) {
      this.onCommand(message)
      return
    }

    if (message.channel.id !== storyChannelId) {
      return
    }

    if (this.isOn) {
      if (message.cleanContent.startsWith(this.settings.adminPrefix)) {
        return
      }

      this.stories.onWord(message)
    }
  }

  private async onCommand(message: Message) {
    const [commandName, ...args] = message.cleanContent.trim().split(' ')
    const isAdmin =
      message.author.id === process.env.CHLORO_USER_ID ||
      this.settings.adminRoles.some((role) =>
        message.member?.roles.cache.has(role)
      )

    if (isAdmin) {
      if (commandName === '!on') {
        this.isOn = true
        return message.reply(`${this.settings.name} has been enabled`)
      }

      if (commandName === '!off') {
        this.isOn = false
        return message.reply(`${this.settings.name} has been disabled`)
      }
    }

    if (!this.isOn) {
      return
    }

    if (this.settings.commands.includes(commandName)) {
      ;(message.channel as TextChannel).sendTyping()
    }

    if (commandName === '!story') {
      return this.stories.displayStory(message)
    }

    if (commandName === '!end') {
      return this.stories.end(message, args.join(' '))
    }

    if (commandName === '!reset') {
      return this.stories.reset(message)
    }

    if (commandName.startsWith('!translate')) {
      return translate(message)
    }
  }

  async start() {
    this.client = new Client({ intents: this.settings.intents })
    this.setupEventListeners()
    await this.client.login(this.settings.token)
  }

  async stop() {
    this.client.destroy()
  }

  async restart() {
    await this.stop()
    await this.start()
  }
}
