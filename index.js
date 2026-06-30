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
const userTimers = {}; // यूजर का सेट किया हुआ टाइमर सेव करने के लिए

const userQueues = {}; 
const isProcessingQueue = {};

// आपकी तीनों लिंक्स (अल्टरनेट रोटेशन के लिए)
const promoLinks = [
  '📢 चैनल: https://t.me/gkandgs12',
  '💬 ग्रुप: https://t.me/gkandgs85',
  '🏆 क्विज: https://t.me/QuizClub15seconds'
];
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
      ctx.reply(`👑 **प्रणाम CP Rawat Sir!**\nआपका 'अल्टरनेट लिंक' और 'कस्टम टाइमर' सिस्टम चालू है।👇`, mainKeyboard);
  } else {
      ctx.reply(`🛑 यह CP Rawat Sir का प्राइवेट बोट है।\nकृपया मास्टर पासवर्ड दर्ज करें:`);
  }
});

bot.hears('📝 क्विज बनाएं (Create)', (ctx) => {
  const userId = ctx.from.id.toString();
  if (!authenticatedUsers.has(userId)) return ctx.reply('❌ पहले लॉगिन करें!');
  userStates[userId] = 'CREATE_POLL';
  userTimers[userId] = 2000; // साधारण बनाने के लिए फिक्स 2 सेकंड
  ctx.reply('📝 **क्विज मोड चालू!**\nअपने प्रश्न बुक फॉर्मेट में यहाँ पेस्ट करें। (लिंक्स अल्टरनेट तरीके से खुद सेट हो जाएंगी)');
});

bot.hears('📢 ऑटो-पोस्ट चैनल में (Auto-Post)', (ctx) => {
  const userId = ctx.from.id.toString();
  if (!authenticatedUsers.has(userId)) return ctx.reply('❌ पहले लॉगिन करें!');
  
  // टाइमर पूछने वाले स्टेट में डालें
  userStates[userId] = 'AWAITING_TIMER';
  ctx.reply(`⏱️ **टाइमर सेट करें!**\n\nऑटो-पोस्ट के लिए दो प्रश्नों के बीच कितने सेकंड का गैप रखना चाहते हैं?\n(कृपया केवल नंबर टाइप करें, जैसे: 30, 60, या 3600 एक घंटे के लिए)`);
});

bot.hears('🔑 यूजर परमिशन (Allow)', (ctx) => {
  ctx.reply('🔑 किसी भी यूजर का मैसेज मुझे फॉरवर्ड करें, मैं आईडी दूँगा। फिर `/allow ID` लिखें।');
});
bot.hears('ℹ️ सही फॉर्मेट / हेल्प', (ctx) => {
  ctx.reply(`⚠️ सही उत्तर के आगे ✅ लगाना ज़रूरी है।`);
});

bot.on('text', async (ctx, next) => {
  const text = ctx.message.text;
  const userId = ctx.from.id.toString();

  if (text === currentPassword) {
      authenticatedUsers.add(userId);
      allowedUsers.add(userId);
      return ctx.reply('✅ पासवर्ड सही है! बोट अनलॉक हो गया है।', mainKeyboard);
  }

  // टाइमर सेट करना
  if (userStates[userId] === 'AWAITING_TIMER') {
      const timeInSeconds = parseInt(text);
      if (isNaN(timeInSeconds) || timeInSeconds < 2) {
          return ctx.reply('❌ कृपया कम से कम 2 या उससे अधिक का सही नंबर (सेकंड में) दर्ज करें।');
      }
      userTimers[userId] = timeInSeconds * 1000; // मिलीसेकंड में बदलें
      userStates[userId] = 'AUTO_POST_MODE';
      return ctx.reply(`✅ टाइमर सेट हो गया: हर ${timeInSeconds} सेकंड में 1 प्रश्न पोस्ट होगा।\n\n📢 अब अपने 50-100 प्रश्न एक साथ यहाँ पेस्ट कर दीजिए।`);
  }

  // प्रश्न पकड़ना
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

    // लिंक्स अल्टरनेट (Rotate) करने का आपका शानदार लॉजिक
    let currentPromo = promoLinks[addedCount % 3]; 

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().startsWith('व्याख्या:') || line.toLowerCase().startsWith('explain:')) {
        let ext = line.replace(/व्याख्या:|explain:/i, '').trim();
        // अब हमारे पास 150-160 अक्षरों की फुल स्पेस है!
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
      
      userQueues[userId].push({
          question, options, correctOptionId, explanation: explanationText, isAutoPost 
      });
      addedCount++;
    }
  }

  if (addedCount > 0) {
      ctx.reply(`📥 आपके ${addedCount} प्रश्न कतार (Queue) में लग गए हैं। प्रक्रिया शुरू हो रही है...`);
      if (!isProcessingQueue[userId]) {
          processQueue(ctx, userId);
      }
  }
}

async function processQueue(ctx, userId) {
  isProcessingQueue[userId] = true;

  while (userQueues[userId] && userQueues[userId].length > 0) {
      const quizData = userQueues[userId].shift();
      const delay = userTimers[userId] || 2000; // सेट किया हुआ टाइमर यूज़ करें

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

      // ⏳ आपके द्वारा सेट किया गया टाइमर (गैप) यहाँ काम करेगा
      await new Promise(resolve => setTimeout(resolve, delay));
  }

  isProcessingQueue[userId] = false;
  ctx.reply(`✅ आपके सभी प्रश्न सफलतापूर्वक तैयार/पोस्ट हो गए हैं!`);
}

const app = express();
app.get('/', (req, res) => res.send('CP Rawat Sir Super Bot Active!'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 Phase 1 Super Bot Started!'));
