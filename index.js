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

const userTimers = { quiz: 2000, post: 3600000 }; 
const userQueues = {}; 
const isProcessingQueue = {};
const pdfData = {}; 

const promoLinks = [
  '📢 चैनल: https://t.me/gkandgs12',
  '💬 ग्रुप: https://t.me/gkandgs85',
  '🏆 क्विज: https://t.me/QuizClub15seconds'
];
const TARGET_CHANNEL = '@gkandgs12';

process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

// कीबोर्ड
const mainMenu = Markup.keyboard([
  ['📝 क्विज (Quiz)', '📰 थ्योरी / पोस्ट'],
  ['📄 PDF मेकर (नोट्स)', '⚙️ सेटिंग्स']
]).resize();

const quizMenu = Markup.keyboard([
  ['✍️ नया क्विज बनाएं', '📢 क्विज ऑटो-पोस्ट (चैनल)'],
  ['🔙 मुख्य मेनू']
]).resize();

const postMenu = Markup.keyboard([
  ['📝 स्मार्ट थ्योरी पोस्ट डालें', '🌐 करंट अफेयर्स (चैनल में डालें)'],
  ['🔙 मुख्य मेनू']
]).resize();

const pdfMenu = Markup.keyboard([
  ['🆕 नई PDF बनाना शुरू करें'],
  ['🔙 मुख्य मेनू']
]).resize();

const settingsMenu = Markup.keyboard([
  ['⏱️ क्विज टाइमर', '⏱️ पोस्ट टाइमर'],
  ['🔑 यूजर परमिशन', '🔙 मुख्य मेनू']
]).resize();

bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  if (allowedUsers.has(userId) || authenticatedUsers.has(userId)) {
      ctx.reply(`👑 **प्रणाम CP Rawat Sir!**\nआपका मास्टर बोट चालू है।👇`, mainMenu);
  } else {
      ctx.reply(`🛑 यह प्राइवेट बोट है। मास्टर पासवर्ड दर्ज करें:`);
  }
});

bot.hears('🔙 मुख्य मेनू', (ctx) => {
    userStates[ctx.from.id.toString()] = '';
    ctx.reply('🏠 मुख्य मेनू', mainMenu);
});

bot.hears('📝 क्विज (Quiz)', (ctx) => ctx.reply('📝 क्विज सेक्शन', quizMenu));
bot.hears('📰 थ्योरी / पोस्ट', (ctx) => ctx.reply('📰 थ्योरी और पोस्ट सेक्शन', postMenu));
bot.hears('📄 PDF मेकर (नोट्स)', (ctx) => ctx.reply('📄 PDF मेकर सेक्शन', pdfMenu));
bot.hears('⚙️ सेटिंग्स', (ctx) => ctx.reply('⚙️ सेटिंग्स सेक्शन', settingsMenu));

// ⏱️ टाइमर सेटिंग्स
bot.hears('⏱️ क्विज टाइमर', (ctx) => {
    userStates[ctx.from.id.toString()] = 'SET_QUIZ_TIMER';
    ctx.reply('⏱️ क्विज के लिए कितने **सेकंड** का गैप रखना है?');
});

bot.hears('⏱️ पोस्ट टाइमर', (ctx) => {
    userStates[ctx.from.id.toString()] = 'SET_POST_TIMER';
    ctx.reply('⏱️ पोस्ट के लिए कितने **मिनट** का गैप रखना है?');
});

bot.hears('✍️ नया क्विज बनाएं', (ctx) => {
    if (!authenticatedUsers.has(ctx.from.id.toString())) return;
    userStates[ctx.from.id.toString()] = 'CREATE_POLL';
    ctx.reply('📝 अपने क्विज प्रश्न पेस्ट करें।');
});

bot.hears('📢 क्विज ऑटो-पोस्ट (चैनल)', (ctx) => {
    if (!authenticatedUsers.has(ctx.from.id.toString())) return;
    userStates[ctx.from.id.toString()] = 'AUTO_POST_MODE';
    ctx.reply(`📢 क्विज ऑटो-पोस्ट चालू! प्रश्न डालें।`);
});

// 🌐 स्मार्ट करंट अफेयर्स / पोस्ट
bot.hears('🌐 करंट अफेयर्स (चैनल में डालें)', (ctx) => {
    if (!authenticatedUsers.has(ctx.from.id.toString())) return;
    userStates[ctx.from.id.toString()] = 'CURRENT_AFFAIRS';
    ctx.reply(`📰 अपना करंट अफेयर्स या न्यूज़ यहाँ पेस्ट करें। मैं इसे ब्रांडिंग के साथ चैनल में भेज दूँगा!`);
});

// 📄 PDF मेकर
bot.hears('🆕 नई PDF बनाना शुरू करें', (ctx) => {
    const userId = ctx.from.id.toString();
    userStates[userId] = 'PDF_STEP_1';
    pdfData[userId] = {};
    ctx.reply('📄 **PDF मेकर चालू!**\n\n**स्टेप 1:** इस PDF का टाइटल (Heading) लिखकर भेजिए।');
});

bot.on('message', async (ctx, next) => {
    if (!ctx.message.text && !ctx.message.photo) return next();
    const text = ctx.message.text || '';
    const userId = ctx.from.id.toString();

    if (text === currentPassword) {
        authenticatedUsers.add(userId);
        allowedUsers.add(userId);
        return ctx.reply('✅ पासवर्ड सही है! बोट अनलॉक हो गया है।', mainMenu);
    }
    if (!authenticatedUsers.has(userId)) return next();

    if (userStates[userId] === 'SET_QUIZ_TIMER') {
        const time = parseInt(text);
        if (!isNaN(time)) {
            userTimers.quiz = time * 1000;
            userStates[userId] = '';
            return ctx.reply(`✅ क्विज टाइमर सेट हो गया!`);
        }
    }
    if (userStates[userId] === 'SET_POST_TIMER') {
        const time = parseInt(text);
        if (!isNaN(time)) {
            userTimers.post = time * 60 * 1000;
            userStates[userId] = '';
            return ctx.reply(`✅ पोस्ट टाइमर सेट हो गया!`);
        }
    }

    // करंट अफेयर्स पोस्टिंग लॉजिक
    if (userStates[userId] === 'CURRENT_AFFAIRS') {
        const formattedPost = `🔴 **ताज़ा जानकारी (Current Affairs)** 🔴\n\n${text}\n\n━━━━━━━━━━━━━━━━━━━━\n🎓 **Study with CP Rawat Sir**\n${promoLinks[0]}\n${promoLinks[1]}`;
        await bot.telegram.sendMessage(TARGET_CHANNEL, formattedPost, { parse_mode: 'Markdown' });
        userStates[userId] = '';
        return ctx.reply('✅ आपकी पोस्ट शानदार ब्रांडिंग के साथ चैनल में भेज दी गई है!');
    }

    // असली PDF जनरेटर लॉजिक
    if (userStates[userId] === 'PDF_STEP_1') {
        pdfData[userId].title = text;
        userStates[userId] = 'PDF_STEP_2';
        return ctx.reply(`✅ टाइटल सेट!\n\n**स्टेप 2:** अब पूरी थ्योरी/नोट्स पेस्ट करें।`);
    }
    if (userStates[userId] === 'PDF_STEP_2') {
        pdfData[userId].content = text;
        userStates[userId] = '';
        ctx.reply('⏳ शानदार रंग-बिरंगी PDF बनाई जा रही है... कृपया 10 सेकंड रुकें।');

        try {
            const doc = new PDFDocument({ margin: 50 });
            const fileName = `CP_Rawat_Notes_${Date.now()}.pdf`;
            const stream = fs.createWriteStream(fileName);
            doc.pipe(stream);

            // हिंदी फॉन्ट लोड करना (जो आपने अपलोड किया है)
            let fontPath = 'NotoSansDevanagari-Regular.ttf';
            if (fs.existsSync(fontPath)) {
                doc.font(fontPath);
            }

            // ब्रांडिंग हेडर
            doc.fontSize(22).fillColor('#D32F2F').text('Study with CP Rawat Sir', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(12).fillColor('#1976D2').text('MP TET / MP Board / All Exams', { align: 'center' });
            doc.moveDown(1.5);

            // टाइटल
            doc.fontSize(18).fillColor('#388E3C').text(pdfData[userId].title, { align: 'center', underline: true });
            doc.moveDown(1);

            // मुख्य थ्योरी
            doc.fontSize(14).fillColor('#000000').text(pdfData[userId].content, { align: 'left', lineGap: 4 });
            doc.moveDown(2);

            // फुटर (लिंक्स)
            doc.fontSize(11).fillColor('#1976D2').text('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', { align: 'center' });
            doc.text('हमारे टेलीग्राम ग्रुप्स से जुड़ें:', { align: 'center' });
            doc.text('Channel: t.me/gkandgs12  |  Group: t.me/gkandgs85', { align: 'center' });

            doc.end();

            stream.on('finish', async () => {
                await ctx.replyWithDocument({ source: fileName, filename: `${pdfData[userId].title}.pdf` }, { caption: `✅ **${pdfData[userId].title}**\n\n📚 नोट्स तैयार हैं सर!` });
                fs.unlinkSync(fileName); // सर्वर से कचरा साफ करना
            });
        } catch (error) {
            ctx.reply(`❌ PDF बनाने में एरर: ${error.message}`);
        }
        return;
    }

    // क्विज बनाना
    if (userStates[userId] === 'CREATE_POLL' || userStates[userId] === 'AUTO_POST_MODE') {
        const isAutoPost = userStates[userId] === 'AUTO_POST_MODE';
        addQuizzesToQueue(ctx, text, userId, isAutoPost);
        return;
    }

    await next();
});

function addQuizzesToQueue(ctx, text, userId, isAutoPost) {
  const rawQuestions = text.split(/(?=Q\.|Q\s|प्रश्न\s|प्र\.)/i);
  if (!userQueues[userId]) userQueues[userId] = [];
  let addedCount = 0;

  for (const rawQ of rawQuestions) {
    if (!rawQ.trim() || rawQ.trim().length < 10) continue;
    const lines = rawQ.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let question = lines[0];
    let options = [];
    let correctOptionId = -1;
    let explanationText = "";
    
    let currentPromo = promoLinks[addedCount % 3]; 

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
      userQueues[userId].push({ question, options, correctOptionId, explanation: explanationText, isAutoPost });
      addedCount++;
    }
  }

  if (addedCount > 0) {
      ctx.reply(`📥 ${addedCount} प्रश्न कतार में लग गए हैं।`);
      if (!isProcessingQueue[userId]) processQueue(ctx, userId);
  }
}

async function processQueue(ctx, userId) {
  isProcessingQueue[userId] = true;
  while (userQueues[userId] && userQueues[userId].length > 0) {
      const quizData = userQueues[userId].shift();
      const delay = userTimers.quiz; 

      try {
          if (quizData.isAutoPost) {
              await bot.telegram.sendQuiz(TARGET_CHANNEL, quizData.question, quizData.options, {
                  correct_option_id: quizData.correctOptionId, explanation: quizData.explanation, is_anonymous: true
              });
          } else {
              await ctx.replyWithQuiz(quizData.question, quizData.options, {
                  correct_option_id: quizData.correctOptionId, explanation: quizData.explanation, is_anonymous: true 
              });
          }
      } catch (err) { console.log(`एरर: ${err.message}`); }

      await new Promise(resolve => setTimeout(resolve, delay));
  }
  isProcessingQueue[userId] = false;
  ctx.reply(`✅ सभी पोल सफलतापूर्वक तैयार हो गए!`);
}

const app = express();
app.get('/', (req, res) => res.send('CP Rawat Sir Super Bot is 24/7 Active!'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 CP Master Bot Started!'));
