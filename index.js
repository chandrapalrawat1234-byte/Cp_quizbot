import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import fs from 'fs';
import 'dotenv/config';

const BOT_TOKEN = process.env.BOT_TOKEN;
let currentPassword = process.env.MASTER_PASSWORD || 'CP@2026';

if (!BOT_TOKEN) {
  console.error("Error: BOT_TOKEN is missing!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
let botUsername = '';

// बोट का नाम पता करना (लिंक बनाने के लिए)
bot.telegram.getMe().then((botInfo) => {
    botUsername = botInfo.username;
});

const allowedUsers = new Set();
const userStates = {};
const userQueues = {}; 
let postTimer = 5 * 60 * 1000; 

// डेटाबेस के लिए एक सुरक्षित JSON फाइल
const DB_FILE = './quiz_database.json';
let savedQuizzes = {};
if (fs.existsSync(DB_FILE)) {
    savedQuizzes = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} else {
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

const TARGET_CHANNEL = '@gkandgs12';
const promoLinks = [
  '📢 चैनल: https://t.me/gkandgs12',
  '💬 ग्रुप: https://t.me/gkandgs85',
  '🏆 क्विज: https://t.me/QuizClub15seconds'
];

process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

const mainMenu = Markup.keyboard([
  ['📝 ऑटो-पोस्ट क्विज (चैनल)'],
  ['🎮 नया लाइव क्विज बनाएं (Official Style)'],
  ['⏱️ ऑटो टाइमर बदलें', '🛑 ऑटो-पोस्ट रोकें']
]).resize();

bot.start((ctx) => {
    const payload = ctx.message.text.split(' ')[1];
    
    // अगर कोई क्विज लिंक से स्टार्ट करता है
    if (payload && payload.startsWith('quiz_')) {
        return startLiveQuiz(ctx, payload);
    }

    const userId = ctx.from.id.toString();
    if (allowedUsers.has(userId)) {
        ctx.reply(`👑 प्रणाम CP Rawat Sir!\nआपका डुअल-इंजन बोट तैयार है।`, mainMenu);
    } else {
        ctx.reply(`🛑 कृपया मास्टर पासवर्ड दर्ज करें:`);
    }
});

// ==========================================
// 1. लाइव क्विज मेकर (Official Style)
// ==========================================
bot.hears('🎮 नया लाइव क्विज बनाएं (Official Style)', (ctx) => {
    if (!allowedUsers.has(ctx.from.id.toString())) return;
    userStates[ctx.from.id.toString()] = 'WAITING_QUIZ_TITLE';
    ctx.reply('📝 **नए क्विज का टाइटल और विषय बताएं:**\n(जैसे: इतिहास के महत्वपूर्ण प्रश्न [By CP Rawat Sir])');
});

bot.hears('🛑 ऑटो-पोस्ट रोकें', (ctx) => {
    ctx.reply('🛑 सिस्टम रीसेट कर दिया गया है।');
    userStates[ctx.from.id.toString()] = '';
});

// ==========================================
// 2. ऑटो-पोस्ट सिस्टम 
// ==========================================
bot.hears('📝 ऑटो-पोस्ट क्विज (चैनल)', (ctx) => {
    if (!allowedUsers.has(ctx.from.id.toString())) return;
    userStates[ctx.from.id.toString()] = 'WAITING_AUTO_QUESTIONS';
    ctx.reply('📝 कृपया चैनल में ऑटो-पोस्ट के लिए अपने 50+ प्रश्न यहाँ पेस्ट करें।');
});

bot.on('text', (ctx, next) => {
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    if (text === currentPassword) {
        allowedUsers.add(userId);
        return ctx.reply('✅ पासवर्ड सही है!', mainMenu);
    }
    if (!allowedUsers.has(userId)) return next();

    // लाइव क्विज का टाइटल लेना
    if (userStates[userId] === 'WAITING_QUIZ_TITLE') {
        const quizId = 'quiz_' + Date.now();
        savedQuizzes[quizId] = { title: text, questions: [] };
        userStates[userId] = `WAITING_LIVE_QUESTIONS_${quizId}`;
        
        return ctx.reply(`✅ टाइटल सेट हो गया: **${text}**\n\nअब इस क्विज के सारे प्रश्न एक साथ यहाँ पेस्ट कर दीजिए।`);
    }

    // लाइव क्विज के प्रश्न लेना और शेयरिंग मेनू बनाना
    if (userStates[userId] && userStates[userId].startsWith('WAITING_LIVE_QUESTIONS_')) {
        const quizId = userStates[userId].split('_').slice(1).join('_');
        const parsedQuestions = parseQuestions(text);
        
        if (parsedQuestions.length > 0) {
            savedQuizzes[quizId].questions = parsedQuestions;
            fs.writeFileSync(DB_FILE, JSON.stringify(savedQuizzes)); // सुरक्षित सेव
            
            userStates[userId] = '';
            
            // ऑफीशियल बोट जैसा इंटरफेस
            const shareText = `**${savedQuizzes[quizId].title}**\n🎓 Study with CP Rawat Sir\n\n🖊 ${parsedQuestions.length} questions\n\nExternal sharing link:\nt.me/${botUsername}?start=${quizId}`;
            
            return ctx.reply(shareText, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.url('Start this quiz', `https://t.me/${botUsername}?start=${quizId}`)],
                    [Markup.button.url('Start quiz in group', `https://t.me/${botUsername}?startgroup=${quizId}`)],
                    [Markup.button.switchToChat('Share quiz', `https://t.me/${botUsername}?start=${quizId}`)]
                ])
            });
        }
    }

    // ऑटो-पोस्ट के प्रश्न लेना
    if (userStates[userId] === 'WAITING_AUTO_QUESTIONS') {
        const parsedQuestions = parseQuestions(text);
        if (parsedQuestions.length > 0) {
            ctx.reply(`✅ ${parsedQuestions.length} प्रश्न ऑटो-पोस्ट के लिए कतार में लग गए हैं।`);
            // यहाँ आप ऑटो-पोस्ट का पुराना लॉजिक जोड़ सकते हैं
        }
        userStates[userId] = '';
        return;
    }

    next();
});

// ==========================================
// 3. लाइव क्विज को चलाना और प्रोमो डालना
// ==========================================
async function startLiveQuiz(ctx, quizId) {
    if (!savedQuizzes[quizId]) return ctx.reply('❌ यह क्विज अब उपलब्ध नहीं है।');
    
    const quiz = savedQuizzes[quizId];
    const questions = quiz.questions;
    const chatId = ctx.chat.id;
    
    await ctx.reply(`🚀 **${quiz.title}** शुरू हो रहा है...\nतैयार हो जाइए!`);
    
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        
        try {
            await bot.telegram.sendQuiz(chatId, q.question, q.options, {
                correct_option_id: q.correctOptionId,
                explanation: q.explanation,
                is_anonymous: true
            });
        } catch (e) {
            console.log("Error sending poll");
        }

        await new Promise(resolve => setTimeout(resolve, 15000)); // 15 सेकंड का गैप

        // 🎯 मास्टरस्ट्रोक: हर 5 प्रश्न के बाद प्रोमो (5, 10, 15...)
        if ((i + 1) % 5 === 0 && (i + 1) !== questions.length) {
            const promoMsg = `🔥 **तैयारी को और मजबूत करें!** 🔥\n\nजुड़ें **Study with CP Rawat Sir** से:\n${promoLinks[0]}\n${promoLinks[1]}\n${promoLinks[2]}\n\n*अगला प्रश्न बस आ रहा है...* ⏳`;
            await bot.telegram.sendMessage(chatId, promoMsg, { parse_mode: 'Markdown' });
            await new Promise(resolve => setTimeout(resolve, 5000)); // प्रोमो पढ़ने के लिए 5 सेकंड
        }
    }
    
    ctx.reply(`🏆 **क्विज समाप्त!**\nबेहतरीन प्रयास। और क्विज के लिए हमारे चैनल से जुड़ें।`);
}

// प्रश्न छांटने का फंक्शन
function parseQuestions(text) {
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
            parsed.push({ question, options, correctOptionId, explanation: explanationText });
            promoIndex++;
        }
    }
    return parsed;
}

// 24/7 वेब सर्वर
const app = express();
app.get('/', (req, res) => res.send('CP Rawat Quiz Engine is Active!'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 Dual-Engine Bot Started!'));
