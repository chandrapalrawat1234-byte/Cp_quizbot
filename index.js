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

// कतारें (Queues)
const channelQueues = {}; 
const botQueues = {}; 

const channelIntervals = {}; 
const botIntervals = {}; 

let postTimer = 5 * 60 * 1000; // डिफ़ॉल्ट 5 मिनट (चैनल के लिए)
const BOT_CHAT_DELAY = 2500;   // बोट चैट में पोल जनरेट करने का सुरक्षित गैप (2.5 सेकंड)

const TARGET_CHANNEL = '@gkandgs12';
const promoLinks = [
  '📢 चैनल: https://t.me/gkandgs12',
  '💬 ग्रुप: https://t.me/gkandgs85',
  '🏆 क्विज: https://t.me/QuizClub15seconds'
];

// 🛡️ क्रैश-प्रूफ कवच (बोट को कभी बंद नहीं होने देगा)
process.on('uncaughtException', (err) => console.log('अंदरूनी एरर रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

const mainMenu = Markup.keyboard([
  ['📝 ऑटो-पोल (चैनल हेतु)', '✍️ बल्क-पोल (बोट चैट हेतु)'],
  ['⏱️ टाइमर बदलें', 'ℹ️ स्टेटस चेक करें'],
  ['🛑 पोस्टिंग रोकें']
]).resize();

bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  if (allowedUsers.has(userId)) {
      ctx.reply(`👑 प्रणाम CP Rawat Sir!\nआपका बिना रुके चलने वाला ऑल-इन-वन इंजन तैयार है।👇`, mainMenu);
  } else {
      ctx.reply(`🛑 कृपया मास्टर密码 (Password) दर्ज करें:`);
  }
});

bot.hears('🛑 पोस्टिंग रोकें', (ctx) => {
    const userId = ctx.from.id.toString();
    
    // चैनल पोस्टिंग रोकना
    if (channelIntervals[userId]) {
        clearInterval(channelIntervals[userId]);
        delete channelIntervals[userId];
    }
    // बोट चैट जनरेशन रोकना
    if (botIntervals[userId]) {
        clearInterval(botIntervals[userId]);
        delete botIntervals[userId];
    }
    
    channelQueues[userId] = [];
    botQueues[userId] = [];
    ctx.reply('🛑 सभी कतारें साफ कर दी गई हैं और पोस्टिंग रोक दी गई है।');
});

bot.hears('ℹ️ स्टेटस चेक करें', (ctx) => {
    const userId = ctx.from.id.toString();
    const chanRemaining = channelQueues[userId] ? channelQueues[userId].length : 0;
    const botRemaining = botQueues[userId] ? botQueues[userId].length : 0;
    const minutes = postTimer / 60000;
    
    ctx.reply(`📊 **बोट इंजन स्टेटस:**\n\n🕒 चैनल टाइमर: हर ${minutes} मिनट\n📢 चैनल कतार में बचे प्रश्न: ${chanRemaining}\n🤖 बोट चैट कतार में बचे प्रश्न: ${botRemaining}`);
});

bot.hears('⏱️ टाइमर बदलें', (ctx) => {
    userStates[ctx.from.id.toString()] = 'SET_TIMER';
    ctx.reply('⏱️ चैनल पोस्टिंग के लिए हर प्रश्न के बीच कितने **मिनट** का गैप रखना है? (सिर्फ नंबर लिखें)');
});

bot.hears('📝 ऑटो-पोल (चैनल हेतु)', (ctx) => {
    if (!allowedUsers.has(ctx.from.id.toString())) return;
    userStates[ctx.from.id.toString()] = 'AUTO_POLL_MODE';
    ctx.reply('📝 **चैनल ऑटो-पोस्ट मोड एक्टिव:**\nअपने 50-100 प्रश्न यहाँ पेस्ट करें। ये सीधे आपके चैनल में टाइमर के हिसाब से जाएंगे।');
});

bot.hears('✍️ बल्क-पोल (बोट चैट हेतु)', (ctx) => {
    if (!allowedUsers.has(ctx.from.id.toString())) return;
    userStates[ctx.from.id.toString()] = 'BOT_POLL_MODE';
    ctx.reply('✍️ **बोट चैट बल्क मोड एक्टिव:**\nअपने 50-100 प्रश्न यहाँ पेस्ट करें। बोट इसी चैट में एक-एक करके सारे पोल तुरंत जनरेट कर देगा।');
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
        return ctx.reply(`✅ चैनल टाइमर बदला: अब हर ${text} मिनट में 1 पोल जाएगा।`);
    }

    // प्रश्न प्राप्त होने पर प्रसंस्करण
    if (text.length > 20 && text.includes('✅')) {
        const currentMode = userStates[userId];
        if (currentMode === 'AUTO_POLL_MODE' || currentMode === 'BOT_POLL_MODE') {
            await startProcessing(ctx, text, userId, currentMode);
            userStates[userId] = ''; // स्टेट क्लियर
        }
    }
});

// प्रश्नों को छांटने और व्याख्या सेट करने का मुख्य फंक्शन
async function startProcessing(ctx, text, userId, mode) {
    const rawQuestions = text.split(/(?=Q\.|Q\s|प्रश्न\s|प्र\.)/i);
    let parsed = [];
    let promoIndex = 0;

    for (const rawQ of rawQuestions) {
        if (!rawQ.trim() || rawQ.trim().length < 10) continue;
        const lines = rawQ.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        let question = lines[0];
        let options = [];
        let correctOptionId = -1;
        let explanationText = "";
        
        let currentPromo = promoLinks[promoIndex % 3]; // अल्टरनेट लिंक लॉजिक

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.toLowerCase().startsWith('व्याख्या:') || line.toLowerCase().startsWith('explain:')) {
                let ext = line.replace(/व्याख्या:|explain:/i, '').trim();
                if (ext.length > 150) ext = ext.substring(0, 147) + '...'; // 150 अक्षरों की लिमिट
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
            promoIndex++;
        }
    }

    if (parsed.length === 0) return ctx.reply('❌ कोई मान्य प्रश्न प्रारूप नहीं मिला। कृपया उत्तर के आगे ✅ अवश्य लगाएं।');

    // मोड के अनुसार कतार में डालना
    if (mode === 'AUTO_POLL_MODE') {
        if (!channelQueues[userId]) channelQueues[userId] = [];
        channelQueues[userId].push(...parsed);
        ctx.reply(`✅ आपके ${parsed.length} प्रश्न **चैनल कतार** में लग गए हैं। पोस्टिंग जारी है...`);
        runChannelWorker(userId, ctx.chat.id);
    } 
    else if (mode === 'BOT_POLL_MODE') {
        if (!botQueues[userId]) botQueues[userId] = [];
        botQueues[userId].push(...parsed);
        ctx.reply(`⏳ आपके ${parsed.length} प्रश्न **बोट चैट** में एक-एक करके जनरेट होना शुरू हो रहे हैं...`);
        runBotChatWorker(userId, ctx.chat.id);
    }
}

// 1. चैनल में भेजने वाला वर्कर
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
        bot.telegram.sendMessage(chatId, `🚨 **सर, चैनल के लिए डाले गए सभी प्रश्न समाप्त हो गए हैं!**`);
        return;
    }

    const q = channelQueues[userId].shift();
    try {
        await bot.telegram.sendQuiz(TARGET_CHANNEL, q.question, q.options, {
            correct_option_id: q.correctOptionId,
            explanation: q.explanation,
            is_anonymous: true
        });
    } catch (err) {
        console.log("चैनल पोस्ट एरर:", err.message);
    }
}

// 2. बोट चैट के अंदर ही लगातार पोल जनरेट करने वाला वर्कर
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
        bot.telegram.sendMessage(chatId, `✅ **सर, बोट चैट हेतु आपके सभी पोल सफलतापूर्वक जनरेट हो चुके हैं!**`);
        return;
    }

    const q = botQueues[userId].shift();
    try {
        await bot.telegram.sendQuiz(chatId, q.question, q.options, {
            correct_option_id: q.correctOptionId,
            explanation: q.explanation,
            is_anonymous: true
        });
    } catch (err) {
        console.log("बोट चैट पोल एरर:", err.message);
    }
}

// 💓 इंटरनल हार्टबीट इंजन (बोट को 24 घंटे लगातार जगाए रखने का अटूट लूप)
setInterval(() => {
    // यह खाली लूप इवेंट ड्राइव को लगातार व्यस्त रखता है जिससे फ्री सर्वर इसे आइडल समझकर सुला नहीं पाता।
    const date = new Date().toISOString();
    // अंदरूनी लॉगिंग जो बैकग्राउंड को ज़िंदा रखती है
}, 1000); 

const app = express();
app.get('/', (req, res) => res.send('CP Rawat Master Engine v5.5 is Fully Hot & Alive!'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 Ultimate Anti-Sleep Bot Started!'));
