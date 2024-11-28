import {} from 'discord.js'

export class Vybe {
  private intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]

  constructor() {}

  start() {}

  stop() {}
}
