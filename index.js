import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import 'dotenv/config';

const BOT_TOKEN = process.env.BOT_TOKEN;
let currentPassword = process.env.MASTER_PASSWORD || 'CP@2026';

if (!BOT_TOKEN) {
  console.error("Error: BOT_TOKEN is missing!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const allowedUsers = new Set();
const userStates = {};

// 📦 कतारें (Queues) और मेमोरी
const channelQueues = {}; 
const botQueues = {}; 
const channelIntervals = {}; 
const botIntervals = {}; 
const userPromoIndex = {}; // यह याद रखेगा कि पिछली बार कौन सी लिंक गई थी

let postTimer = 5 * 60 * 1000; // डिफ़ॉल्ट 5 मिनट 
const BOT_CHAT_DELAY = 2500;   // बोट चैट का सुरक्षित गैप (2.5 सेकंड)

const TARGET_CHANNEL = '@gkandgs12';
const promoLinks = [
  '📢 चैनल: https://t.me/gkandgs12',
  '💬 ग्रुप: https://t.me/gkandgs85',
  '🏆 क्विज: https://t.me/QuizClub15seconds'
];

// 🛡️ क्रैश-प्रूफ कवच
process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

const mainMenu = Markup.keyboard([
  ['📝 ऑटो-पोल (चैनल हेतु)', '✍️ बल्क-पोल (बोट चैट हेतु)'],
  ['⏱️ टाइमर बदलें', 'ℹ️ स्टेटस चेक करें'],
  ['🛑 पोस्टिंग रोकें']
]).resize();

bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  if (allowedUsers.has(userId)) {
      ctx.reply(`👑 प्रणाम CP Rawat Sir!\nआपका फुल-प्रूफ ऑटो इंजन तैयार है।👇`, mainMenu);
  } else {
      ctx.reply(`🛑 कृपया मास्टर पासवर्ड दर्ज करें:`);
  }
});

bot.hears('🛑 पोस्टिंग रोकें', (ctx) => {
    const userId = ctx.from.id.toString();
    if (channelIntervals[userId]) clearInterval(channelIntervals[userId]);
    if (botIntervals[userId]) clearInterval(botIntervals[userId]);
    delete channelIntervals[userId];
    delete botIntervals[userId];
    channelQueues[userId] = [];
    botQueues[userId] = [];
    ctx.reply('🛑 सभी कतारें साफ कर दी गई हैं और पोस्टिंग पूरी तरह रोक दी गई है।');
});

bot.hears('ℹ️ स्टेटस चेक करें', (ctx) => {
    const userId = ctx.from.id.toString();
    const chanRemaining = channelQueues[userId] ? channelQueues[userId].length : 0;
    const botRemaining = botQueues[userId] ? botQueues[userId].length : 0;
    const minutes = postTimer / 60000;
    ctx.reply(`📊 **बोट स्टेटस:**\n🕒 चैनल टाइमर: हर ${minutes} मिनट\n📢 चैनल कतार: ${chanRemaining} प्रश्न\n🤖 बोट चैट कतार: ${botRemaining} प्रश्न`);
});

bot.hears('⏱️ टाइमर बदलें', (ctx) => {
    userStates[ctx.from.id.toString()] = 'SET_TIMER';
    ctx.reply('⏱️ चैनल के लिए कितने **मिनट** का गैप रखना है? (सिर्फ नंबर लिखें)');
});

bot.hears('📝 ऑटो-पोल (चैनल हेतु)', (ctx) => {
    if (!allowedUsers.has(ctx.from.id.toString())) return;
    userStates[ctx.from.id.toString()] = 'AUTO_POLL_MODE';
    ctx.reply('📝 **चैनल ऑटो-पोस्ट मोड:**\nअपने प्रश्न पेस्ट करें। टेलीग्राम बड़े मैसेज को खुद टुकड़ों में भेजेगा, मैं उन्हें कतार में जोड़ता जाऊँगा।');
});

bot.hears('✍️ बल्क-पोल (बोट चैट हेतु)', (ctx) => {
    if (!allowedUsers.has(ctx.from.id.toString())) return;
    userStates[ctx.from.id.toString()] = 'BOT_POLL_MODE';
    ctx.reply('✍️ **बोट चैट बल्क मोड:**\nअपने प्रश्न पेस्ट करें। मैं यहीं जनरेट करूँगा ताकि आप उन्हें आगे फॉरवर्ड कर सकें।');
});

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    if (text === currentPassword) {
        allowedUsers.add(userId);
        return ctx.reply('✅ पासवर्ड सही है! बोट अनलॉक हो गया।', mainMenu);
    }
    if (!allowedUsers.has(userId)) return next();

    if (userStates[userId] === 'SET_TIMER' && !isNaN(text)) {
        postTimer = Number(text) * 60 * 1000;
        userStates[userId] = '';
        return ctx.reply(`✅ टाइमर बदला: अब हर ${text} मिनट में 1 पोल जाएगा।`);
    }

    // अगर प्रश्न पेस्ट किए गए हैं
    if (text.length > 20 && text.includes('✅')) {
        const currentMode = userStates[userId];
        if (currentMode === 'AUTO_POLL_MODE' || currentMode === 'BOT_POLL_MODE') {
            await startProcessing(ctx, text, userId, currentMode);
        }
    }
});

async function startProcessing(ctx, text, userId, mode) {
    const rawQuestions = text.split(/(?=Q\.|Q\s|प्रश्न\s|प्र\.)/i);
    let parsed = [];
    
    // लिंक रोटेशन मेमोरी
    if (userPromoIndex[userId] === undefined) userPromoIndex[userId] = 0;

    for (const rawQ of rawQuestions) {
        if (!rawQ.trim() || rawQ.trim().length < 10) continue;
        const lines = rawQ.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        let question = lines[0];
        let options = [];
        let correctOptionId = -1;
        let explanationText = "";
        
        let currentPromo = promoLinks[userPromoIndex[userId] % 3]; 

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.toLowerCase().startsWith('व्याख्या:') || line.toLowerCase().startsWith('explain:')) {
                let ext = line.replace(/व्याख्या:|explain:/i, '').trim();
                if (ext.length > 150) ext = ext.substring(0, 147) + '...'; 
                explanationText = `${ext}\n\n${currentPromo}`;
                break;
            }
            if (line.match(/^[A-D]\)|^[A-D]\.|^[1-4]\)|^[1-4]\./i)) {
                let cleanOption = line.replace(/^[A-D]\)|^[A-D]\.|^[1-4]\)|^[1-4]\./i, '').trim();
                if (line.includes('✅')) {
                    cleanOption = cleanOption.replace('✅', '').trim();
                    correctOptionId = options.length;
                }
                options.push(cleanOption);
            }
        }

        if (options.length >= 2 && correctOptionId !== -1) {
            if (!explanationText) explanationText = `📚 नोट्स व क्विज के लिए जुड़ें!\n\n${currentPromo}`;
            parsed.push({ question, options, correctOptionId, explanation: explanationText });
            userPromoIndex[userId]++; 
        }
    }

    if (parsed.length === 0) return;

    if (mode === 'AUTO_POLL_MODE') {
        if (!channelQueues[userId]) channelQueues[userId] = [];
        channelQueues[userId].push(...parsed);
        ctx.reply(`✅ ${parsed.length} नए प्रश्न जुड़े। (कुल कतार: ${channelQueues[userId].length})\nपोस्टिंग चालू है...`);
        runChannelWorker(userId, ctx.chat.id);
    } 
    else if (mode === 'BOT_POLL_MODE') {
        if (!botQueues[userId]) botQueues[userId] = [];
        botQueues[userId].push(...parsed);
        ctx.reply(`⏳ ${parsed.length} नए प्रश्न जुड़े। (कुल कतार: ${botQueues[userId].length})\nबोट चैट में पोल जनरेट हो रहे हैं...`);
        runBotChatWorker(userId, ctx.chat.id);
    }
}

// ==========================================
// इंजन 1: चैनल ऑटो-पोस्ट (टाइमर के साथ)
// ==========================================
function runChannelWorker(userId, chatId) {
    if (channelIntervals[userId]) return;
    sendNextChannelQuiz(userId, chatId);
    channelIntervals[userId] = setInterval(() => {
        sendNextChannelQuiz(userId, chatId);
    }, postTimer);
}

async function sendNextChannelQuiz(userId, chatId) {
    if (!channelQueues[userId] || channelQueues[userId].length === 0) {
        clearInterval(channelIntervals[userId]);
        delete channelIntervals[userId];
        bot.telegram.sendMessage(chatId, `🚨 **सर, चैनल कतार के सारे प्रश्न खत्म हो गए हैं!**`);
        return;
    }
    const q = channelQueues[userId].shift();
    try {
        await bot.telegram.sendQuiz(TARGET_CHANNEL, q.question, q.options, {
            correct_option_id: q.correctOptionId,
            explanation: q.explanation,
            is_anonymous: true
        });
    } catch (err) { console.log("चैनल पोल एरर:", err.message); }
}

// ==========================================
// इंजन 2: बोट चैट बल्क पोस्ट (तेजी से जनरेट करने के लिए)
// ==========================================
function runBotChatWorker(userId, chatId) {
    if (botIntervals[userId]) return;
    sendNextBotQuiz(userId, chatId);
    botIntervals[userId] = setInterval(() => {
        sendNextBotQuiz(userId, chatId);
    }, BOT_CHAT_DELAY);
}

async function sendNextBotQuiz(userId, chatId) {
    if (!botQueues[userId] || botQueues[userId].length === 0) {
        clearInterval(botIntervals[userId]);
        delete botIntervals[userId];
        bot.telegram.sendMessage(chatId, `✅ **बोट चैट के सभी पोल सफलतापूवर्क जनरेट हो गए हैं!**`);
        return;
    }
    const q = botQueues[userId].shift();
    try {
        await bot.telegram.sendQuiz(chatId, q.question, q.options, {
            correct_option_id: q.correctOptionId,
            explanation: q.explanation,
            is_anonymous: true
        });
    } catch (err) { console.log("बोट चैट पोल एरर:", err.message); }
}

// 🌐 24/7 वेब सर्वर (अलार्म सिस्टम के लिए)
const app = express();
app.get('/', (req, res) => res.send('CP Rawat Master Bot is Active!'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 फुल-प्रूफ बोट स्टार्ट हो गया है!'));

