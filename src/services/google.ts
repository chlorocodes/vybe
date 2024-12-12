import { join } from 'node:path'
import { v2 } from '@google-cloud/translate'

class GoogleService {
  private translator = new v2.Translate({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID as string,
    keyFilename: join(__dirname, '..', '..', 'google-keys.json')
  })

  async translate(text: string) {
    const [translation] = await this.translator.translate(text, { to: 'en' })
    return translation
  }
}

export const googleService = new GoogleService()
