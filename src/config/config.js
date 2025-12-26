import dotenv from 'dotenv'
import __dirname from '../../__dirname.js'

dotenv.config({
    override: true,
    path: `${__dirname}/.env`
})

export const config = {
    PORT: process.env.PORT,
    VERIFY_TOKEN: process.env.VERIFY_TOKEN,
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
    WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    META_APP_SECRET: process.env.META_APP_SECRET
}