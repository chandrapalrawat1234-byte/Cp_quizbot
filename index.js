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

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection at:', promise, 'reason:', reason));

// 1. वेलकम मैसेज (बटन्स और स्पष्ट लिंक्स के साथ)
bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  const firstName = ctx.from.first_name;
  
  // अगर बाहरी व्यक्ति आता है, तो सीधे चैनल पर भेजो
  if (!allowedUsers.has(userId) && !authenticatedUsers.has(userId)) {
      const publicText = 
        `🛑 **यह CP Rawat Sir का प्राइवेट क्विज बोट है।**\n\n` +
        `यदि आप फ्री PDF, शानदार नोट्स और डेली 100+ क्विज लगाना चाहते हैं, तो अभी हमारे ऑफिशियल प्लेटफॉर्म्स से जुड़ें:\n\n` +
        `📢 **मुख्य चैनल:**\n${CHANNEL_LINK}\n\n` +
        `💬 **डिस्कशन ग्रुप:**\n${GROUP_LINK}\n\n` +
        `🏆 **क्विज क्लब:**\n${QUIZ_CLUB_LINK}`;
      
      return ctx.reply(publicText, Markup.inlineKeyboard([
          [Markup.button.url('📢 अभी चैनल जॉइन करें', CHANNEL_LINK)],
          [Markup.button.callback('🔐 एडमिन लॉगिन', 'login_bot')]
      ]));
  }

  // एडमिन के लिए वेलकम मैसेज
  const adminText = 
    `👑 **प्रणाम CP Rawat Sir / एडमिन!**\n\n` +
    `आपके सुपर बोट का कंट्रोल पैनल तैयार है। कृपया नीचे दिए गए बटनों का उपयोग करें:\n\n` +
    `🔗 **आपकी लिंक्स:**\n` +
    `चैनल: ${CHANNEL_LINK}\n` +
    `ग्रुप: ${GROUP_LINK}\n` +
    `क्विज: ${QUIZ_CLUB_LINK}`;

  ctx.reply(adminText, Markup.inlineKeyboard([
    [Markup.button.callback('🆕 Create (क्विज बनाएं)', 'create_menu')],
    [Markup.button.callback('❓ Help', 'help_format'), Markup.button.callback('ℹ️ About', 'about_bot')]
  ]));
});

// About बटन
bot.action('about_bot', (ctx) => {
    ctx.reply(`👑 **निर्माता:** CP Rawat Sir\n📢 **चैनल:** ${CHANNEL_LINK}\n\nयह बोट बल्क में क्विज और पोल बनाने के लिए विशेष रूप से डिज़ाइन किया गया है।`);
});

// Help बटन
bot.action('help_format', (ctx) => {
  const helpText = 
    `📖 **प्रश्न पेस्ट करने का बुक फॉर्मेट:**\n\n` +
    `Q. मध्य प्रदेश का सबसे बड़ा राष्ट्रीय उद्यान कौन सा है?\n` +
    `A) बांधवगढ़\n` +
    `B) कान्हा किसली ✅\n` +
    `C) पन्ना\n` +
    `D) सतपुड़ा\n\n` +
    `व्याख्या: कान्हा किसली सबसे बड़ा उद्यान है।\n\n` +
    `⚠️ **नोट:** सही उत्तर के आगे हरा टिक (✅) लगाना अनिवार्य है।`;
  ctx.reply(helpText);
});

// Create बटन (Anonymous vs Public)
bot.action('create_menu', (ctx) => {
    const userId = ctx.from.id.toString();
    if (!authenticatedUsers.has(userId) && !allowedUsers.has(userId)) {
        return ctx.reply('❌ कृपया पहले लॉगिन करें।');
    }
    ctx.reply('आप किस प्रकार का प्रश्न बनाना चाहते हैं?', Markup.inlineKeyboard([
        [Markup.button.callback('🔒 Anonymous (गुप्त - ऑफिशियल बोट के लिए)', 'mode_anonymous')],
        [Markup.button.callback('👁️ Public (नाम दिखने वाला पोल)', 'mode_public')]
    ]));
});

bot.action('mode_anonymous', (ctx) => {
    const userId = ctx.from.id.toString();
    userStates[userId] = 'CREATE_ANONYMOUS';
    ctx.reply('🔒 **Anonymous मोड चालू!**\nकृपया अपने प्रश्न बुक फॉर्मेट में यहाँ पेस्ट करें:');
});

bot.action('mode_public', (ctx) => {
    const userId = ctx.from.id.toString();
    userStates[userId] = 'CREATE_PUBLIC';
    ctx.reply('👁️ **Public मोड चालू!**\nकृपया अपने प्रश्न बुक फॉर्मेट में यहाँ पेस्ट करें:\n*(ध्यान दें: पब्लिक पोल ऑफिशियल @QuizBot में सपोर्ट नहीं करते)*');
});

bot.action('login_bot', (ctx) => {
    userStates[ctx.from.id.toString()] = 'AWAITING_PASSWORD';
    ctx.reply('🔒 कृपया मास्टर पासवर्ड दर्ज करें:');
});

// सीक्रेट कोड और टेक्स्ट हैंडलिंग
bot.hears('/public cprawat sir @818182', (ctx) => {
  const userId = ctx.from.id.toString();
  allowedUsers.add(userId); 
  authenticatedUsers.add(userId); 
  ctx.reply(`👑 **मालिक की पहचान हो गई!**\nपैनल अनलॉक है। मेनू देखने के लिए /start दबाएं।`);
});

bot.on('text', async (ctx, next) => {
  const text = ctx.message.text;
  const userId = ctx.from.id.toString();

  if (userStates[userId] === 'AWAITING_PASSWORD') {
    if (text === currentPassword) {
      authenticatedUsers.add(userId);
      delete userStates[userId];
      return ctx.reply('✅ पासवर्ड सही है! मेनू देखने के लिए /start दबाएं।');
    } else {
      return ctx.reply('❌ गलत पासवर्ड!');
    }
  }

  // अगर यूजर क्रिएट मोड में है
  if (userStates[userId] === 'CREATE_ANONYMOUS' || userStates[userId] === 'CREATE_PUBLIC') {
      const isAnonymous = userStates[userId] === 'CREATE_ANONYMOUS';
      await parseAndCreateQuizzes(ctx, text, isAnonymous);
      return;
  }

  await next();
});

// क्विज पार्सर
async function parseAndCreateQuizzes(ctx, text, isAnonymous) {
  const rawQuestions = text.split(/(?=Q\.|Q\s|प्रश्न\s|प्र\.)/i);
  let successCount = 0;
  ctx.reply(`⏳ प्रक्रिया चालू है...`);

  for (const rawQ of rawQuestions) {
    if (!rawQ.trim() || rawQ.trim().length < 10) continue;

    const lines = rawQ.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let question = lines[0];
    let options = [];
    let correctOptionId = -1;
    let explanation = `📢 Join: ${CHANNEL_LINK}`;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().startsWith('व्याख्या:') || line.toLowerCase().startsWith('explain:')) {
        let ext = line.replace(/व्याख्या:|explain:/i, '').trim();
        // 200 कैरेक्टर लिमिट का ध्यान रखते हुए
        if (ext.length > 150) ext = ext.substring(0, 145) + '...';
        explanation = `${ext}\n🔗 ${CHANNEL_LINK}`;
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

    if (options.length >= 2 && options.length <= 10 && correctOptionId !== -1) {
      try {
        await ctx.replyWithQuiz(question, options, {
          correct_option_id: correctOptionId,
          explanation: explanation,
          is_anonymous: isAnonymous
        });
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 500)); 
      } catch (err) {
        console.error('एरर:', err.message);
      }
    }
  }
  ctx.reply(`✅ ${successCount} प्रश्न सफलतापूर्वक तैयार!`);
}

const app = express();
app.get('/', (req, res) => res.send('Bot is Running!'));
app.listen(process.env.PORT || 3000);
bot.launch();
