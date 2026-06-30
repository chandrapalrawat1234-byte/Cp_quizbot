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

const CHANNEL_LINK = 'https://t.me/gkandgs12';
const GROUP_LINK = 'https://t.me/gkandgs85';
const QUIZ_CLUB_LINK = 'https://t.me/QuizClub15seconds';
const TARGET_CHANNEL = '@gkandgs12'; // ऑटो-पोस्ट के लिए चैनल का यूजरनेम

// 🛑 सुपर एंटी-क्रैश: कोई भी एरर बोट को बंद नहीं कर पाएगा
process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

// 📱 नीचे कीबोर्ड (Sticker Area) वाले परमानेंट बटन्स
const mainKeyboard = Markup.keyboard([
  ['📝 क्विज बनाएं (Create)', '🔑 यूजर परमिशन (Allow)'],
  ['📢 ऑटो-पोस्ट चैनल में (Auto-Post)', 'ℹ️ सही फॉर्मेट / हेल्प']
]).resize();

// 1. स्टार्ट कमांड
bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  if (allowedUsers.has(userId) || authenticatedUsers.has(userId)) {
      ctx.reply(`👑 **प्रणाम CP Rawat Sir!**\nआपका परमानेंट कीबोर्ड नीचे (टाइपिंग एरिया में) एक्टिव कर दिया गया है।👇`, mainKeyboard);
  } else {
      ctx.reply(`🛑 यह CP Rawat Sir का प्राइवेट बोट है।\nकृपया पासवर्ड दर्ज करें (पासवर्ड पता है तो सीधे टाइप करें):`);
  }
});

// 2. परमानेंट कीबोर्ड बटन्स के एक्शन
bot.hears('📝 क्विज बनाएं (Create)', (ctx) => {
  const userId = ctx.from.id.toString();
  if (!authenticatedUsers.has(userId)) return ctx.reply('❌ पहले लॉगिन करें!');
  
  userStates[userId] = 'CREATE_POLL';
  ctx.reply('📝 **क्विज मोड चालू!**\nअपने प्रश्न बुक फॉर्मेट में यहाँ पेस्ट करें। (मैं उन्हें तुरंत यहीं पर क्विज में बदल दूँगा)');
});

bot.hears('🔑 यूजर परमिशन (Allow)', (ctx) => {
  const userId = ctx.from.id.toString();
  if (!authenticatedUsers.has(userId)) return ctx.reply('❌ पहले लॉगिन करें!');
  ctx.reply('🔑 **परमिशन कैसे दें?**\nकिसी भी यूजर का कोई भी मैसेज मुझे फॉरवर्ड करें, मैं उसकी आईडी निकाल कर दूँगा। फिर आप `/allow ID` लिखकर उसे चालू कर सकते हैं।');
});

bot.hears('ℹ️ सही फॉर्मेट / हेल्प', (ctx) => {
  const helpText = 
    `📖 **सही बुक फॉर्मेट (जिसे बोट तुरंत पहचानता है):**\n\n` +
    `Q. मानव शरीर की सबसे बड़ी ग्रंथि कौन सी है?\n` +
    `A) थायराइड\n` +
    `B) यकृत ✅\n` +
    `C) पिट्यूटरी\n` +
    `D) अग्न्याशय\n\n` +
    `व्याख्या: यकृत शरीर की सबसे बड़ी ग्रंथि है।\n\n` +
    `⚠️ **नोट:** सही उत्तर के आगे ✅ लगाना ज़रूरी है और हर प्रश्न के बीच एक खाली लाइन (Space) छोड़ें।`;
  ctx.reply(helpText);
});

bot.hears('📢 ऑटो-पोस्ट चैनल में (Auto-Post)', (ctx) => {
  const userId = ctx.from.id.toString();
  if (!authenticatedUsers.has(userId)) return ctx.reply('❌ पहले लॉगिन करें!');
  
  userStates[userId] = 'AUTO_POST_MODE';
  ctx.reply(`📢 **ऑटो-पोस्ट मोड चालू!**\n\nअपने सभी 50-100 प्रश्न यहाँ पेस्ट करें। बोट उन्हें अपने अंदर सेव कर लेगा और अपने आप सीधे आपके चैनल (${TARGET_CHANNEL}) में भेजना शुरू कर देगा।\n(बोट को चैनल में एडमिन बनाना न भूलें!)`);
});

// 3. साधारण टेक्स्ट और प्रश्न पकड़ना
bot.on('text', async (ctx, next) => {
  const text = ctx.message.text;
  const userId = ctx.from.id.toString();

  // पासवर्ड चेक
  if (text === currentPassword) {
      authenticatedUsers.add(userId);
      allowedUsers.add(userId);
      return ctx.reply('✅ पासवर्ड सही है! आपका बोट अनलॉक हो गया है।', mainKeyboard);
  }

  // आईडी फाइंडर (फॉरवर्ड मैसेज)
  if (ctx.message.forward_date) {
    if (ctx.message.forward_from) {
      return ctx.reply(`🔍 **यूजर आईडी:** \`${ctx.message.forward_from.id}\`\nइसे परमिशन देने के लिए लिखें: \`/allow ${ctx.message.forward_from.id}\``, { parse_mode: 'Markdown' });
    }
  }

  // परमिशन कमांड
  if (text.startsWith('/allow ') && allowedUsers.has(userId)) {
    const target = text.split(' ')[1];
    allowedUsers.add(target.trim());
    return ctx.reply(`✅ यूज़र ${target} को परमिशन मिल गई है।`);
  }

  // क्विज बनाना (डायरेक्ट)
  if (userStates[userId] === 'CREATE_POLL') {
      await processQuizzes(ctx, text, false);
      return;
  }

  // ऑटो पोस्ट (चैनल के लिए)
  if (userStates[userId] === 'AUTO_POST_MODE') {
      await processQuizzes(ctx, text, true);
      return;
  }

  await next();
});

// 4. मुख्य इंजन: प्रश्नों को पढ़ना और बनाना (बिना क्रैश हुए)
async function processQuizzes(ctx, text, isAutoPost) {
  const rawQuestions = text.split(/(?=Q\.|Q\s|प्रश्न\s|प्र\.)/i);
  let successCount = 0;
  
  ctx.reply(`⏳ प्रश्नों की छंटाई चालू है, कृपया प्रतीक्षा करें...`);

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
        // टेलीग्राम की 200 अक्षर लिमिट का परमानेंट इलाज (ताकि बोट क्रैश न हो)
        if (ext.length > 150) ext = ext.substring(0, 145) + '...';
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
      try {
        if (isAutoPost) {
            // ऑटो-पोस्ट: सीधे चैनल में भेजना
            await bot.telegram.sendQuiz(TARGET_CHANNEL, question, options, {
                correct_option_id: correctOptionId,
                explanation: explanation,
                is_anonymous: true
            });
        } else {
            // साधारण मोड: आपको यहीं रिप्लाई करना
            await ctx.replyWithQuiz(question, options, {
                correct_option_id: correctOptionId,
                explanation: explanation,
                is_anonymous: true // ऑफिशियल बोट के लिए गुप्त रखना ज़रूरी है
            });
        }
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 1500)); // स्पैम से बचने के लिए टाइमर
      } catch (err) {
        console.log(`प्रश्न स्किप किया गया (टेलीग्राम एरर): ${err.message}`);
      }
    }
  }
  ctx.reply(`✅ काम पूरा हुआ! कुल ${successCount} पोल सफलता पूर्वक ${isAutoPost ? 'चैनल में भेज दिए गए हैं' : 'तैयार हैं'}!`, mainKeyboard);
}

// 5. सर्वर और 24/7 चालू रखने का सिस्टम
const app = express();
app.get('/', (req, res) => res.send('CP Rawat Sir Super Bot is 24/7 Active!'));
app.listen(process.env.PORT || 3000, () => {
    console.log("Web server is running!");
});

bot.launch().then(() => {
  console.log('🚀 CP Super Bot Started Successfully!');
});

