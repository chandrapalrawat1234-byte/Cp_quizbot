import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import 'dotenv/config';

const BOT_TOKEN = process.env.BOT_TOKEN;
let currentPassword = process.env.MASTER_PASSWORD || 'CP@2026';

if (!BOT_TOKEN) {
  console.error("Error: BOT_TOKEN is missing!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const allowedUsers = new Set(); 
const authenticatedUsers = new Set(); 
const userStates = {}; 
const userTimers = { quiz: 2000, post: 3600000 }; // क्विज का 2 सेकंड, पोस्ट का 1 घंटा (डिफ़ॉल्ट)
const pdfData = {}; // PDF बनाने के लिए डेटा सेव करने की जगह

const promoLinks = [
  '📢 चैनल: https://t.me/gkandgs12',
  '💬 ग्रुप: https://t.me/gkandgs85',
  '🏆 क्विज: https://t.me/QuizClub15seconds'
];
const TARGET_CHANNEL = '@gkandgs12';

process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

// ==========================================
// 📱 लेवल-वाइज कीबोर्ड (Level-wise Keyboards)
// ==========================================

const mainMenu = Markup.keyboard([
  ['📝 क्विज (Quiz)', '📰 थ्योरी / पोस्ट'],
  ['📄 PDF मेकर (नोट्स)', '⚙️ सेटिंग्स']
]).resize();

const quizMenu = Markup.keyboard([
  ['✍️ नया क्विज डालें', '📢 क्विज ऑटो-पोस्ट (चैनल)'],
  ['🔙 मुख्य मेनू']
]).resize();

const postMenu = Markup.keyboard([
  ['📝 नई पोस्ट डालें', '📢 पोस्ट ऑटो-पब्लिश'],
  ['🔙 मुख्य मेनू']
]).resize();

const pdfMenu = Markup.keyboard([
  ['🆕 नई PDF बनाना शुरू करें'],
  ['🔙 मुख्य मेनू']
]).resize();

const settingsMenu = Markup.keyboard([
  ['⏱️ क्विज टाइमर सेट करें', '⏱️ पोस्ट टाइमर सेट करें'],
  ['🔑 यूजर परमिशन', '🔙 मुख्य मेनू']
]).resize();

// ==========================================
// 🚀 स्टार्ट और नेविगेशन (Navigation)
// ==========================================

bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  if (allowedUsers.has(userId) || authenticatedUsers.has(userId)) {
      ctx.reply(`👑 **प्रणाम CP Rawat Sir!**\nआपका एडवांस 'लेवल-वाइज' सिस्टम चालू है।\nनीचे दिए गए मेनू से विकल्प चुनें:👇`, mainMenu);
  } else {
      ctx.reply(`🛑 यह CP Rawat Sir का प्राइवेट बोट है।\nकृपया मास्टर पासवर्ड दर्ज करें:`);
  }
});

// बैक बटन
bot.hears('🔙 मुख्य मेनू', (ctx) => {
    userStates[ctx.from.id.toString()] = ''; // स्टेट क्लियर करें
    ctx.reply('🏠 आप मुख्य मेनू में हैं।', mainMenu);
});

// मेन बटन क्लिक्स
bot.hears('📝 क्विज (Quiz)', (ctx) => ctx.reply('📝 **क्विज सेक्शन** में आपका स्वागत है।', quizMenu));
bot.hears('📰 थ्योरी / पोस्ट', (ctx) => ctx.reply('📰 **थ्योरी और पोस्ट सेक्शन** खुला है।', postMenu));
bot.hears('📄 PDF मेकर (नोट्स)', (ctx) => ctx.reply('📄 **PDF मेकर** तैयार है।', pdfMenu));
bot.hears('⚙️ सेटिंग्स', (ctx) => ctx.reply('⚙️ **सेटिंग्स** खुल गई हैं।', settingsMenu));

// ==========================================
// ⏱️ टाइमर सेटिंग्स
// ==========================================

bot.hears('⏱️ क्विज टाइमर सेट करें', (ctx) => {
    userStates[ctx.from.id.toString()] = 'SET_QUIZ_TIMER';
    ctx.reply('⏱️ क्विज के लिए कितने **सेकंड** का गैप रखना है? (नंबर लिखें)');
});

bot.hears('⏱️ पोस्ट टाइमर सेट करें', (ctx) => {
    userStates[ctx.from.id.toString()] = 'SET_POST_TIMER';
    ctx.reply('⏱️ थ्योरी पोस्ट के लिए कितने **मिनट** का गैप रखना है? (नंबर लिखें)');
});

// ==========================================
// 📄 PDF विज़ार्ड (Step-by-Step PDF Maker)
// ==========================================

bot.hears('🆕 नई PDF बनाना शुरू करें', (ctx) => {
    const userId = ctx.from.id.toString();
    userStates[userId] = 'PDF_STEP_1_TITLE';
    pdfData[userId] = {};
    ctx.reply('📄 **PDF मेकर चालू!**\n\n**स्टेप 1:** सबसे पहले इस PDF का टाइटल (Heading) लिखकर भेजिए।\n(जैसे: प्रकाश का परावर्तन)');
});

// ==========================================
// 🧠 मुख्य इंजन (मैसेज पकड़ना)
// ==========================================

bot.on('message', async (ctx, next) => {
    if (!ctx.message.text && !ctx.message.photo) return next();
    
    const text = ctx.message.text || '';
    const userId = ctx.from.id.toString();

    // पासवर्ड चेक
    if (text === currentPassword) {
        authenticatedUsers.add(userId);
        allowedUsers.add(userId);
        return ctx.reply('✅ पासवर्ड सही है! बोट अनलॉक हो गया है।', mainMenu);
    }

    if (!authenticatedUsers.has(userId)) return next();

    // टाइमर सेट करना
    if (userStates[userId] === 'SET_QUIZ_TIMER') {
        const time = parseInt(text);
        if (time > 0) {
            userTimers.quiz = time * 1000;
            userStates[userId] = '';
            return ctx.reply(`✅ क्विज टाइमर सेट: हर ${time} सेकंड में 1 क्विज।`, settingsMenu);
        }
    }

    if (userStates[userId] === 'SET_POST_TIMER') {
        const time = parseInt(text);
        if (time > 0) {
            userTimers.post = time * 60 * 1000; // मिनट को मिलीसेकंड में बदला
            userStates[userId] = '';
            return ctx.reply(`✅ पोस्ट टाइमर सेट: हर ${time} मिनट में 1 पोस्ट।`, settingsMenu);
        }
    }

    // PDF स्टेप 1: टाइटल
    if (userStates[userId] === 'PDF_STEP_1_TITLE') {
        pdfData[userId].title = text;
        userStates[userId] = 'PDF_STEP_2_CONTENT';
        return ctx.reply(`✅ टाइटल सेट हो गया: *${text}*\n\n**स्टेप 2:** अब अपनी पूरी थ्योरी/नोट्स यहाँ पेस्ट करें।`);
    }

    // PDF स्टेप 2: कंटेंट
    if (userStates[userId] === 'PDF_STEP_2_CONTENT') {
        pdfData[userId].content = text;
        userStates[userId] = 'PDF_STEP_3_PHOTO';
        return ctx.reply(`✅ नोट्स सेव हो गए!\n\n**स्टेप 3:** क्या आप PDF में कोई फोटो लगाना चाहते हैं? \nअगर हाँ, तो फोटो भेजिए। \nअगर नहीं, तो **Skip** टाइप करके भेज दीजिए।`);
    }

    // PDF स्टेप 3: फोटो और PDF जनरेशन
    if (userStates[userId] === 'PDF_STEP_3_PHOTO') {
        ctx.reply('⏳ शानदार PDF तैयार की जा रही है, कृपया प्रतीक्षा करें...');
        // (यहाँ अगले चरण में हम असली PDF बनाने का कोड जोड़ेंगे)
        userStates[userId] = '';
        setTimeout(() => {
            ctx.reply('✅ (डेमो) आपकी PDF का डेटा मेरे पास आ गया है! हिंदी फॉन्ट का सेटअप होते ही मैं आपको फाइल दे दूँगा।', pdfMenu);
        }, 2000);
        return;
    }

    await next();
});

const app = express();
app.get('/', (req, res) => res.send('CP Rawat Sir Advanced Bot is Active!'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 Level-Wise Bot Started!'));
