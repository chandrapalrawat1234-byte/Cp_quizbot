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
const authenticatedUsers = new Set(); 
const userStates = {}; 

// यूजर का कतार (Queue) सिस्टम ताकि बोट कभी न अटके
const userQueues = {}; 
const isProcessingQueue = {};

const CHANNEL_LINK = 'https://t.me/gkandgs12';
const GROUP_LINK = 'https://t.me/gkandgs85';
const QUIZ_CLUB_LINK = 'https://t.me/QuizClub15seconds';
const TARGET_CHANNEL = '@gkandgs12';

process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

const mainKeyboard = Markup.keyboard([
  ['📝 क्विज बनाएं (Create)', '🔑 यूजर परमिशन (Allow)'],
  ['📢 ऑटो-पोस्ट चैनल में (Auto-Post)', 'ℹ️ सही फॉर्मेट / हेल्प']
]).resize();

bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  if (allowedUsers.has(userId) || authenticatedUsers.has(userId)) {
      ctx.reply(`👑 **प्रणाम CP Rawat Sir!**\nआपका परमानेंट कीबोर्ड नीचे एक्टिव है। 100 प्रश्नों का नया 'Queue System' चालू है।👇`, mainKeyboard);
  } else {
      ctx.reply(`🛑 यह CP Rawat Sir का प्राइवेट बोट है।\nकृपया पासवर्ड दर्ज करें:`);
  }
});

bot.hears('📝 क्विज बनाएं (Create)', (ctx) => {
  const userId = ctx.from.id.toString();
  if (!authenticatedUsers.has(userId)) return ctx.reply('❌ पहले लॉगिन करें!');
  userStates[userId] = 'CREATE_POLL';
  ctx.reply('📝 **क्विज मोड चालू!**\nअपने 100 प्रश्न यहाँ एक साथ पेस्ट करें। बोट उन्हें लाइन में लगाकर हर 2 सेकंड में 1-1 करके बनाएगा ताकि अटके नहीं।');
});

bot.hears('🔑 यूजर परमिशन (Allow)', (ctx) => {
  const userId = ctx.from.id.toString();
  if (!authenticatedUsers.has(userId)) return ctx.reply('❌ पहले लॉगिन करें!');
  ctx.reply('🔑 **परमिशन कैसे दें?**\nकिसी भी यूजर का मैसेज मुझे फॉरवर्ड करें, मैं आईडी दूँगा। फिर `/allow ID` लिखें।');
});

bot.hears('ℹ️ सही फॉर्मेट / हेल्प', (ctx) => {
  ctx.reply(`⚠️ **नोट:** सही उत्तर के आगे ✅ लगाना ज़रूरी है और हर प्रश्न के बीच एक खाली लाइन छोड़ें।`);
});

bot.hears('📢 ऑटो-पोस्ट चैनल में (Auto-Post)', (ctx) => {
  const userId = ctx.from.id.toString();
  if (!authenticatedUsers.has(userId)) return ctx.reply('❌ पहले लॉगिन करें!');
  userStates[userId] = 'AUTO_POST_MODE';
  ctx.reply(`📢 **ऑटो-पोस्ट चालू!**\nप्रश्न डालें, बोट सीधे चैनल (${TARGET_CHANNEL}) में हर 2 सेकंड में भेजता रहेगा।`);
});

bot.on('text', async (ctx, next) => {
  const text = ctx.message.text;
  const userId = ctx.from.id.toString();

  if (text === currentPassword) {
      authenticatedUsers.add(userId);
      allowedUsers.add(userId);
      return ctx.reply('✅ पासवर्ड सही है! बोट अनलॉक हो गया है।', mainKeyboard);
  }

  if (userStates[userId] === 'CREATE_POLL' || userStates[userId] === 'AUTO_POST_MODE') {
      const isAutoPost = userStates[userId] === 'AUTO_POST_MODE';
      addQuizzesToQueue(ctx, text, userId, isAutoPost);
      return;
  }

  await next();
});

// प्रश्नों को छांटकर कतार (Queue) में डालना
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
    let promo = `\n📢चैनल:${CHANNEL_LINK}`;
    let explanation = `📚 नोट्स व क्विज के लिए जुड़ें!${promo}`;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().startsWith('व्याख्या:') || line.toLowerCase().startsWith('explain:')) {
        let ext = line.replace(/व्याख्या:|explain:/i, '').trim();
        if (ext.length > 150) ext = ext.substring(0, 145) + '...'; // क्रैश रोकने के लिए लिमिट
        explanation = `${ext}${promo}`;
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
      userQueues[userId].push({
          question, 
          options, 
          correctOptionId, 
          explanation, 
          isAutoPost 
      });
      addedCount++;
    }
  }

  if (addedCount > 0) {
      ctx.reply(`📥 आपके ${addedCount} प्रश्न कतार (लाइन) में लग गए हैं। प्रक्रिया चालू है...`);
      // अगर पहले से प्रोसेसिंग नहीं चल रही है, तो चालू करें
      if (!isProcessingQueue[userId]) {
          processQueue(ctx, userId);
      }
  }
}

// कतार को हर 2 सेकंड में एक-एक करके प्रोसेस करना (आपका आइडिया)
async function processQueue(ctx, userId) {
  isProcessingQueue[userId] = true;

  while (userQueues[userId] && userQueues[userId].length > 0) {
      const quizData = userQueues[userId].shift(); // लाइन में से पहला प्रश्न निकालें

      try {
          if (quizData.isAutoPost) {
              await bot.telegram.sendQuiz(TARGET_CHANNEL, quizData.question, quizData.options, {
                  correct_option_id: quizData.correctOptionId,
                  explanation: quizData.explanation,
                  is_anonymous: true
              });
          } else {
              await ctx.replyWithQuiz(quizData.question, quizData.options, {
                  correct_option_id: quizData.correctOptionId,
                  explanation: quizData.explanation,
                  is_anonymous: true 
              });
          }
      } catch (err) {
          console.log(`एरर: ${err.message}`);
      }

      // ⏳ हर प्रश्न के बाद 2 सेकंड का गैप (ताकि टेलीग्राम बोट को ब्लॉक न करे)
      await new Promise(resolve => setTimeout(resolve, 2000));
  }

  isProcessingQueue[userId] = false;
  ctx.reply(`✅ आपके सभी प्रश्न सफलतापूर्वक तैयार हो गए हैं!`);
}

const app = express();
app.get('/', (req, res) => res.send('CP Rawat Sir Super Bot Active!'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 Bot Started!'));

