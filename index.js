import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import Parser from 'rss-parser';
import sqlite3 from 'sqlite3';
import 'dotenv/config';

// 1. बेसिक सेटअप
const BOT_TOKEN = process.env.BOT_TOKEN;
let currentPassword = process.env.MASTER_PASSWORD || 'CP@2026';

if (!BOT_TOKEN) {
  console.error("Error: BOT_TOKEN is missing!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const rssParser = new Parser();
const db = new sqlite3.Database('./quizdata.db'); // डेटाबेस चालू

// 2. मेमोरी और स्टेट्स
const allowedUsers = new Set(); 
const authenticatedUsers = new Set(); 
const userStates = {}; 
const userTimers = { quiz: 2000, post: 3600000 }; 
const pdfData = {}; 
const userQueues = {}; 
const isProcessingQueue = {};

// लाइव ग्रुप क्विज का डेटा
const liveQuizzes = {}; 

const promoLinks = [
  '📢 चैनल: https://t.me/gkandgs12',
  '💬 ग्रुप: https://t.me/gkandgs85',
  '🏆 क्विज: https://t.me/QuizClub15seconds'
];
const TARGET_CHANNEL = '@gkandgs12';

// क्रैश से बचाने का कवच (24/7 के लिए)
process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

// 3. लेवल-वाइज कीबोर्ड
const mainMenu = Markup.keyboard([
  ['📝 क्विज (Quiz)', '📰 थ्योरी / न्यूज़'],
  ['📄 PDF मेकर (नोट्स)', '⚙️ सेटिंग्स']
]).resize();

const quizMenu = Markup.keyboard([
  ['✍️ साधारण क्विज (चैनल)', '🎮 लाइव ग्रुप क्विज (Official Style)'],
  ['🔙 मुख्य मेनू']
]).resize();

const postMenu = Markup.keyboard([
  ['📝 थ्योरी पोस्ट डालें', '🌐 इंटरनेट से ऑटो-न्यूज़ लाएं'],
  ['🔙 मुख्य मेनू']
]).resize();

const pdfMenu = Markup.keyboard([
  ['🆕 नई PDF बनाना शुरू करें'],
  ['🔙 मुख्य मेनू']
]).resize();

const settingsMenu = Markup.keyboard([
  ['⏱️ क्विज टाइमर', '⏱️ पोस्ट टाइमर'],
  ['🔙 मुख्य मेनू']
]).resize();

// 4. नेविगेशन
bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  if (allowedUsers.has(userId) || authenticatedUsers.has(userId)) {
      ctx.reply(`👑 **प्रणाम CP Rawat Sir!**\nआपका ऑल-इन-वन सुपर बोट चालू है।👇`, mainMenu);
  } else {
      ctx.reply(`🛑 यह CP Rawat Sir का प्राइवेट बोट है।\nकृपया मास्टर पासवर्ड दर्ज करें:`);
  }
});

bot.hears('🔙 मुख्य मेनू', (ctx) => {
    userStates[ctx.from.id.toString()] = '';
    ctx.reply('🏠 मुख्य मेनू', mainMenu);
});

bot.hears('📝 क्विज (Quiz)', (ctx) => ctx.reply('📝 क्विज सेक्शन', quizMenu));
bot.hears('📰 थ्योरी / न्यूज़', (ctx) => ctx.reply('📰 थ्योरी और ऑटो-न्यूज़ सेक्शन', postMenu));
bot.hears('📄 PDF मेकर (नोट्स)', (ctx) => ctx.reply('📄 PDF मेकर सेक्शन', pdfMenu));
bot.hears('⚙️ सेटिंग्स', (ctx) => ctx.reply('⚙️ सेटिंग्स सेक्शन', settingsMenu));

// 5. 🌐 इंटरनेट से ऑटो-न्यूज़ (RSS Feed)
bot.hears('🌐 इंटरनेट से ऑटो-न्यूज़ लाएं', async (ctx) => {
    if (!authenticatedUsers.has(ctx.from.id.toString())) return;
    ctx.reply('⏳ इंटरनेट (Google News Hindi) से ताज़ा शिक्षा और दुनिया की खबरें खोजी जा रही हैं...');
    
    try {
        const feed = await rssParser.parseURL('https://news.google.com/rss?hl=hi&gl=IN&ceid=IN:hi');
        const topNews = feed.items.slice(0, 3); // टॉप 3 खबरें
        
        let newsPost = `🔴 **आज की ताज़ा खबरें** 🔴\n\n`;
        topNews.forEach((item, index) => {
            newsPost += `${index + 1}. ${item.title}\n`;
        });

        newsPost += `\n━━━━━━━━━━━━━━━━━━━━\n🎓 **Study with CP Rawat Sir**\n${promoLinks[0]}\n${promoLinks[1]}`;
        
        await bot.telegram.sendMessage(TARGET_CHANNEL, newsPost, { parse_mode: 'Markdown', disable_web_page_preview: true });
        ctx.reply('✅ इंटरनेट से ताज़ा खबरें निकालकर शानदार ब्रांडिंग के साथ चैनल में पोस्ट कर दी गई हैं!');
    } catch (error) {
        ctx.reply('❌ इंटरनेट से जानकारी लाने में समस्या हुई। बाद में प्रयास करें।');
    }
});

// 6. 🎮 लाइव ग्रुप क्विज (I am Ready सिस्टम)
bot.hears('🎮 लाइव ग्रुप क्विज (Official Style)', (ctx) => {
    if (!authenticatedUsers.has(ctx.from.id.toString())) return;
    const chatId = ctx.chat.id;
    liveQuizzes[chatId] = { readyUsers: new Set(), isActive: false };

    ctx.reply(
        '🏆 **नया लाइव क्विज तैयार है!**\n\nक्विज शुरू करने के लिए कम से कम 2 लोगों को नीचे दिए गए बटन पर क्लिक करना होगा।',
        Markup.inlineKeyboard([
            Markup.button.callback('👍 I am Ready (0/2)', 'ready_btn')
        ])
    );
});

bot.action('ready_btn', (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const userName = ctx.from.first_name;

    if (!liveQuizzes[chatId]) return ctx.answerCbQuery('कोई क्विज एक्टिव नहीं है।');
    if (liveQuizzes[chatId].isActive) return ctx.answerCbQuery('क्विज पहले ही शुरू हो चुका है!');

    liveQuizzes[chatId].readyUsers.add(userId);
    const count = liveQuizzes[chatId].readyUsers.size;

    ctx.answerCbQuery(`${userName}, आप तैयार हैं!`);

    if (count >= 2) {
        liveQuizzes[chatId].isActive = true;
        ctx.editMessageText(`🚀 2 लोग तैयार हैं! क्विज शुरू हो रहा है...\n\n(ग्रुप क्विज मोड एक्टिवेटेड)`);
        // यहाँ से बोट ऑटोमैटिक क्विज डालना शुरू करेगा
        setTimeout(() => {
            ctx.reply(`📢 क्विज शुरू! पहला प्रश्न...\n\n(डेमो: यहाँ आपके सेव किए हुए प्रश्न आएंगे)`);
        }, 2000);
    } else {
        ctx.editMessageText(
            `🏆 **नया लाइव क्विज तैयार है!**\n\nक्विज शुरू करने के लिए कम से कम 2 लोगों को नीचे दिए गए बटन पर क्लिक करना होगा।`,
            Markup.inlineKeyboard([
                Markup.button.callback(`👍 I am Ready (${count}/2)`, 'ready_btn')
            ])
        );
    }
});

// 7. 📄 PDF मेकर 
bot.hears('🆕 नई PDF बनाना शुरू करें', (ctx) => {
    const userId = ctx.from.id.toString();
    userStates[userId] = 'PDF_STEP_1';
    pdfData[userId] = {};
    ctx.reply('📄 **PDF मेकर चालू!**\n\n**स्टेप 1:** इस PDF का टाइटल (Heading) लिखकर भेजिए।');
});

// 8. ⏱️ सेटिंग्स 
bot.hears('⏱️ क्विज टाइमर', (ctx) => {
    userStates[ctx.from.id.toString()] = 'SET_QUIZ_TIMER';
    ctx.reply('⏱️ क्विज के लिए कितने **सेकंड** का गैप रखना है?');
});

// 9. 🧠 मुख्य इंजन (मैसेज पकड़ना)
bot.on('message', async (ctx, next) => {
    if (!ctx.message.text) return next();
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    // 🔒 लॉगिन सिस्टम
    if (text === currentPassword) {
        authenticatedUsers.add(userId);
        allowedUsers.add(userId);
        return ctx.reply('✅ पासवर्ड सही है! बोट अनलॉक हो गया है।', mainMenu);
    }
    if (!authenticatedUsers.has(userId)) return next();

    // टाइमर
    if (userStates[userId] === 'SET_QUIZ_TIMER') {
        const time = parseInt(text);
        if (!isNaN(time)) {
            userTimers.quiz = time * 1000;
            userStates[userId] = '';
            return ctx.reply(`✅ क्विज टाइमर सेट हो गया!`);
        }
    }

    // PDF स्टेप्स
    if (userStates[userId] === 'PDF_STEP_1') {
        pdfData[userId].title = text;
        userStates[userId] = 'PDF_STEP_2';
        return ctx.reply(`✅ टाइटल सेट!\n\n**स्टेप 2:** अब पूरी थ्योरी/नोट्स पेस्ट करें।`);
    }
    if (userStates[userId] === 'PDF_STEP_2') {
        pdfData[userId].content = text;
        userStates[userId] = '';
        ctx.reply('⏳ शानदार रंग-बिरंगी PDF बनाई जा रही है... 10 सेकंड रुकें।');

        try {
            const doc = new PDFDocument({ margin: 50 });
            const fileName = `CP_Rawat_Notes_${Date.now()}.pdf`;
            const stream = fs.createWriteStream(fileName);
            doc.pipe(stream);

            let fontPath = 'NotoSansDevanagari-Regular.ttf';
            if (fs.existsSync(fontPath)) doc.font(fontPath);

            doc.fontSize(22).fillColor('#D32F2F').text('Study with CP Rawat Sir', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(12).fillColor('#1976D2').text('MP TET / MP Board / All Exams', { align: 'center' });
            doc.moveDown(1.5);
            doc.fontSize(18).fillColor('#388E3C').text(pdfData[userId].title, { align: 'center', underline: true });
            doc.moveDown(1);
            doc.fontSize(14).fillColor('#000000').text(pdfData[userId].content, { align: 'left', lineGap: 4 });
            doc.moveDown(2);
            doc.fontSize(11).fillColor('#1976D2').text('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', { align: 'center' });
            doc.text(`Channel: t.me/gkandgs12 | Group: t.me/gkandgs85`, { align: 'center' });

            doc.end();

            stream.on('finish', async () => {
                await ctx.replyWithDocument({ source: fileName, filename: `${pdfData[userId].title}.pdf` });
                fs.unlinkSync(fileName);
            });
        } catch (error) { ctx.reply(`❌ PDF एरर: ${error.message}`); }
        return;
    }

    // साधारण क्विज (कतार और रोटेटिंग लिंक्स के साथ)
    bot.hears('✍️ साधारण क्विज (चैनल)', (ctx) => {
        userStates[userId] = 'AUTO_POST_MODE';
        ctx.reply(`📢 क्विज पेस्ट करें। हर 5 प्रश्न के बाद प्रमोशन लिंक भी जाएगी!`);
    });

    if (userStates[userId] === 'AUTO_POST_MODE') {
        addQuizzesToQueue(ctx, text, userId, true);
        return;
    }

    await next();
});

// प्रश्नों की छंटाई और 5-प्रश्न प्रोमो लॉजिक
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
      userQueues[userId].push({ type: 'quiz', question, options, correctOptionId, explanation: explanationText, isAutoPost });
      addedCount++;
      
      // 🚀 मास्टरस्ट्रोक: हर 5 प्रश्न के बाद एक प्रमोशनल पोस्ट डालें
      if (addedCount % 5 === 0) {
          userQueues[userId].push({ 
              type: 'promo', 
              content: `🔥 **तैयारी को और मजबूत करें!** 🔥\n\nहमारे ऑफिशियल चैनल और ग्रुप से अभी जुड़ें:\n\n${promoLinks[0]}\n${promoLinks[1]}\n${promoLinks[2]}`, 
              isAutoPost 
          });
      }
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
      const item = userQueues[userId].shift();
      const delay = userTimers.quiz; 

      try {
          if (item.type === 'promo') {
              // प्रोमो पोस्ट भेजना
              await bot.telegram.sendMessage(TARGET_CHANNEL, item.content, { parse_mode: 'Markdown' });
          } else {
              // पोल भेजना
              await bot.telegram.sendQuiz(TARGET_CHANNEL, item.question, item.options, {
                  correct_option_id: item.correctOptionId, explanation: item.explanation, is_anonymous: true
              });
          }
      } catch (err) { console.log(`एरर: ${err.message}`); }

      await new Promise(resolve => setTimeout(resolve, delay));
  }
  isProcessingQueue[userId] = false;
  ctx.reply(`✅ सभी पोल और प्रोमो सफलतापूर्वक पोस्ट हो गए!`);
}

// 24/7 वेब सर्वर
const app = express();
app.get('/', (req, res) => res.send('CP Rawat Sir Super Bot is 24/7 Active!'));
app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));

bot.launch().then(() => console.log('🚀 Ultimate Bot Started!'));
