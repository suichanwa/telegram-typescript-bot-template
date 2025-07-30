import 'dotenv/config';
import {env} from 'node:process';
import * as cron from 'node-cron';
import {FileAdapter} from '@grammyjs/storage-file';
import {Bot, session} from 'grammy';
import {generateUpdateMiddleware} from 'telegraf-middleware-console-time';
import {html as format} from 'telegram-format';
import {danceWithFairies, fightDragons} from '../magic.js';
import type {MyContext, Session} from './my-context.js';

const token = env['BOT_TOKEN'];
if (!token) {
    throw new Error(
        'You have to provide the bot-token from @BotFather via environment variable (BOT_TOKEN)',
    );
}

const bot = new Bot<MyContext>(token);

// Store activated chat IDs
const activatedChats = new Set<string>();
let cronJob: cron.ScheduledTask | null = null;

bot.use(session({
    initial: (): Session => ({}),
    storage: new FileAdapter(),
}));

if (env['NODE_ENV'] !== 'production') {
    // Show what telegram updates (messages, button clicks, ...) are happening (only in development)
    bot.use(generateUpdateMiddleware());
}

// Function to start the cron job
function startScheduledMessages() {
    if (cronJob) {
        return; // Already running
    }

    cronJob = cron.schedule('0 21 * * *', async () => {
        console.log(`Sending scheduled message to ${activatedChats.size} chats at`, new Date());
        
        for (const chatId of activatedChats) {
            try {
                await bot.api.sendMessage(chatId, 'ну чё когда в факторку');
                console.log(`Scheduled message sent successfully to chat ${chatId}`);
            } catch (error) {
                console.error(`Failed to send scheduled message to chat ${chatId}:`, error);
                // Remove invalid chat ID
                activatedChats.delete(chatId);
            }
        }
    }, {
        timezone: 'Europe/Chisinau' // Moldova timezone
    });

    console.log('Scheduled daily message at 9 PM Moldova time enabled');
}

bot.command('help', async ctx => ctx.reply('This bot sends daily reminders at 9 PM Moldova time.'));

bot.command('magic', async ctx => {
    const combatResult = fightDragons();
    const fairyThoughts = danceWithFairies();

    let text = '';
    text += combatResult;
    text += '\n\n';
    text += fairyThoughts;

    return ctx.reply(text);
});

bot.command('html', async ctx => {
    let text = '';
    text += format.bold('Some');
    text += ' ';
    text += format.spoiler('HTML');
    await ctx.reply(text, {parse_mode: format.parse_mode});
});

bot.command('start', async ctx => {
    const chatId = ctx.chat.id.toString();
    
    // Add this chat to activated chats
    activatedChats.add(chatId);
    console.log(`Chat ${chatId} activated for scheduled messages. Total active chats: ${activatedChats.size}`);
    
    // Start the cron job if it's not running
    startScheduledMessages();
    
    // Reply with confirmation
    await ctx.reply('Привет! Теперь я буду спрашивать "ну чё когда в факторку" каждый день в 21:00 по времени Молдовы! пидорас');
});

// False positive as bot is not a promise
// eslint-disable-next-line unicorn/prefer-top-level-await
bot.catch(error => {
    console.error('ERROR on handling update occured', error);
});

export async function start(): Promise<void> {
    // The commands you set here will be shown as /commands like /start or /magic in your telegram client.
    await bot.api.setMyCommands([
        {command: 'start', description: 'activate daily messages'},
        {command: 'magic', description: 'do magic'},
        {command: 'html', description: 'some html _mode example'},
        {command: 'help', description: 'show the help'},
    ]);

    await bot.start({
        onStart(botInfo) {
            console.log(new Date(), 'Bot starts as', botInfo.username);
        },
    });
}