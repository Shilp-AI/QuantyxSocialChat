# Python example using python-telegram-bot
from telegram import Update, WebAppInfo
from telegram.ext import Application, CommandHandler

async def start(update: Update, context):
    webapp = WebAppInfo(url="https://shilp-ai.github.io")
    keyboard = [[{"text": "Open Creator Bot", "web_app": webapp}]]
    await update.message.reply_text(
        "Click below to open AI Content Creator!",
        reply_markup={"inline_keyboard": keyboard}
    )

app = Application.builder().token("8227632332:AAFTZtOrUl84Rf_1mHLVq0ZdOQVIBiJ041I").build()
app.add_handler(CommandHandler("start", start))
app.run_polling()