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
const userQueues = {}; 
const processingIntervals = {}; 
let postTimer = 5 * 60 * 1000; // डिफ़ॉल्ट 5 मिनट का टाइमर

const TARGET_CHANNEL = '@gkandgs12';
const promoLinks = [
  '📢 चैनल: https://t.me/gkandgs12',
  '💬 ग्रुप: https://t.me/gkandgs85',
  '🏆 क्विज: https://t.me/QuizClub15seconds'
];

// क्रैश से बचाने का कवच
process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

const mainMenu = Markup.keyboard([
  ['📝 ऑटो-क्विज डालें (50+ प्रश्न)'],
  ['⏱️ टाइमर बदलें', 'ℹ️ स्टेटस चेक करें'],
  ['🛑 पोस्टिंग रोकें']
]).resize();

bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  if (allowedUsers.has(userId)) {
      ctx.reply(`👑 प्रणाम CP Rawat Sir!\nआपका सुपरफास्ट ऑटो-पोस्ट बोट चालू है।👇`, mainMenu);
  } else {
      ctx.reply(`🛑 यह प्राइवेट बोट है। कृपया मास्टर पासवर्ड दर्ज करें:`);
  }
});

bot.hears('🛑 पोस्टिंग रोकें', (ctx) => {
    const userId = ctx.from.id.toString();
    if (processingIntervals[userId]) {
        clearInterval(processingIntervals[userId]);
        delete processingIntervals[userId];
        ctx.reply('🛑 ऑटो-पोस्टिंग रोक दी गई है। बचे हुए प्रश्न सुरक्षित हैं।');
    } else {
        ctx.reply('⚠️ अभी कोई पोस्टिंग नहीं चल रही है।');
    }
});

bot.hears('ℹ️ स्टेटस चेक करें', (ctx) => {
    const userId = ctx.from.id.toString();
    const remaining = userQueues[userId] ? userQueues[userId].length : 0;
    const minutes = postTimer / 60000;
    ctx.reply(`📊 **बोट का स्टेटस:**\n\n🕒 टाइमर सेट है: हर ${minutes} मिनट\n📦 कतार में बचे प्रश्न: ${remaining}`);
});

bot.hears('⏱️ टाइमर बदलें', (ctx) => {
    ctx.reply('⏱️ हर प्रश्न के बीच कितने **मिनट** का गैप रखना है? (सिर्फ नंबर लिखें, जैसे: 2, 5, 10)');
});

bot.hears('📝 ऑटो-क्विज डालें (50+ प्रश्न)', (ctx) => {
    if (!allowedUsers.has(ctx.from.id.toString())) return;
    ctx.reply('📝 कृपया अपने 50 (या जितने भी) प्रश्न यहाँ पेस्ट करें। मैं उन्हें कतार में लगा दूँगा।');
});

bot.on('text', (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    // पासवर्ड चेक
    if (text === currentPassword) {
        allowedUsers.add(userId);
        return ctx.reply('✅ पासवर्ड सही है! बोट अनलॉक हो गया।', mainMenu);
    }
    if (!allowedUsers.has(userId)) return;

    // टाइमर सेट करना
    if (!isNaN(text) && Number(text) > 0 && text.length < 5) {
        postTimer = Number(text) * 60 * 1000;
        return ctx.reply(`✅ टाइमर बदल गया! अब हर ${text} मिनट में 1 प्रश्न जाएगा।`);
    }

    // अगर प्रश्न आए हैं
    if (text.length > 20 && text.includes('✅')) {
        addQuizzesToQueue(ctx, text, userId);
    }
});

function addQuizzesToQueue(ctx, text, userId) {
    const rawQuestions = text.split(/(?=Q\.|Q\s|प्रश्न\s|प्र\.)/i);
    if (!userQueues[userId]) userQueues[userId] = [];
    
    let addedCount = 0;
    let promoIndex = 0;

    for (const rawQ of rawQuestions) {
        if (!rawQ.trim() || rawQ.trim().length < 10) continue;
        const lines = rawQ.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        let question = lines[0];
        let options = [];
        let correctOptionId = -1;
        let explanationText = "";
        
        // लिंक्स अल्टरनेट (Rotate) करने का लॉजिक
        let currentPromo = promoLinks[promoIndex % 3];

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
            userQueues[userId].push({ question, options, correctOptionId, explanation: explanationText });
            addedCount++;
            promoIndex++;
        }
    }

    if (addedCount > 0) {
        ctx.reply(`✅ आपके ${addedCount} प्रश्न कतार (Queue) में लग गए हैं।\n⏳ ऑटो-पोस्टिंग शुरू हो रही है...`);
        startAutoPosting(userId, ctx.chat.id);
    }
}

function startAutoPosting(userId, chatId) {
    if (processingIntervals[userId]) return; // पहले से चल रहा है तो दोबारा चालू न करें

    sendNextQuiz(userId, chatId); // तुरंत पहला प्रश्न भेजें

    // फिर टाइमर के हिसाब से लूप चलाएं
    processingIntervals[userId] = setInterval(() => {
        sendNextQuiz(userId, chatId);
    }, postTimer);
}

async function sendNextQuiz(userId, chatId) {
    if (!userQueues[userId] || userQueues[userId].length === 0) {
        // प्रश्न खत्म हो गए
        clearInterval(processingIntervals[userId]);
        delete processingIntervals[userId];
        bot.telegram.sendMessage(chatId, `🚨 **सर, आपके डाले हुए सारे प्रश्न खत्म हो गए हैं!**\n\nकृपया '📝 ऑटो-क्विज डालें' पर क्लिक करके नए प्रश्न पेस्ट कर दीजिए।`);
        return;
    }

    const q = userQueues[userId].shift();
    try {
        await bot.telegram.sendQuiz(TARGET_CHANNEL, q.question, q.options, {
            correct_option_id: q.correctOptionId,
            explanation: q.explanation,
            is_anonymous: true
        });
    } catch (err) {
        console.log("पोस्ट करने में एरर:", err.message);
    }
}

// 24/7 वेब सर्वर (अलार्म)
const app = express();
app.get('/', (req, res) => res.send('CP Rawat Auto-Post Engine Running!'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 Final Bulletproof Bot Started!'));

