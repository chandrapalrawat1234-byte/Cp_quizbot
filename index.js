import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import https from 'https';
import 'dotenv/config';

const BOT_TOKEN = process.env.BOT_TOKEN;
let currentPassword = process.env.MASTER_PASSWORD || 'CP@2026';

if (!BOT_TOKEN) {
  console.error("Error: BOT_TOKEN is missing in environment variables!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// डेटाबेस बैकअप (मेमोरी में)
const allowedUsers = new Set(); 
const authenticatedUsers = new Set(); 
const userStates = {}; 

// आपकी तीनों अधिकृत लिंक्स (व्याख्या में दिखने के लिए)
const CHANNEL_LINK = 'https://t.me/gkandgs12';
const GROUP_LINK = 'https://t.me/gkandgs85';
const QUIZ_CLUB_LINK = 'https://t.me/QuizClub15seconds';
const CHANNEL_USERNAME = '@gkandgs12'; 

// 🛑 एंटी-क्रैश सिस्टम (बोट को कभी बंद या क्रैश नहीं होने देगा)
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection at:', promise, 'reason:', reason));

// 1. मुख्य स्टार्ट मेनू (चारों शानदार बटन और लिंक्स के साथ)
bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  const firstName = ctx.from.first_name;
  
  // बाहरी छात्रों के लिए (सीधे आपके मुख्य चैनल पर रीडायरेक्ट)
  if (!allowedUsers.has(userId) && !authenticatedUsers.has(userId)) {
      const publicText = 
        `🛑 **यह CP Rawat Sir का निजी (Private) क्विज मेकर बोट है।**\n\n` +
        `यदि आप फ्री PDF, हस्तलिखित नोट्स और डेली 100+ धमाकेदार क्विज लगाना चाहते हैं, तो अभी हमारे ऑफिशियल प्लेटफॉर्म्स से जुड़ें:\n\n` +
        `📢 **चैनल लिंक:** ${CHANNEL_LINK}\n\n` +
        `💬 **डिस्कशन ग्रुप:** ${GROUP_LINK}\n\n` +
        `🏆 **क्विज क्लब:** ${QUIZ_CLUB_LINK}\n\n` +
        `⚙️ **निर्माता:** cprawat sir 👑`;
      
      return ctx.reply(publicText, Markup.inlineKeyboard([
          [Markup.button.url('📢 जॉइन ऑफिशियल चैनल', CHANNEL_LINK)],
          [Markup.button.callback('🔐 एडमिन लॉगिन (Login)', 'login_bot')]
      ]));
  }

  // अधिकृत एडमिन्स के लिए 4 बटन वाला मुख्य इंटरफेस
  const adminText = 
    `👑 **प्रणाम CP Rawat Sir / अधिकृत एडमिन!**\n\n` +
    `आपके सुपर बोट का कंट्रोल पैनल पूरी तरह एक्टिव है। नीचे दिए गए बटनों का उपयोग करें:\n\n` +
    `🔗 **आपके प्रमोशन लिंक्स:**\n` +
    `1. मुख्य चैनल: ${CHANNEL_LINK}\n` +
    `2. अभ्यास ग्रुप: ${GROUP_LINK}\n` +
    `3. क्विज क्लब: ${QUIZ_CLUB_LINK}`;

  ctx.reply(adminText, Markup.inlineKeyboard([
    [Markup.button.callback('🆕 Create (क्विज बनाएं)', 'create_menu')],
    [Markup.button.callback('❓ Help / फॉर्मेट', 'help_format'), Markup.button.callback('ℹ️ About Bot', 'about_bot')],
    [Markup.button.url('📢 हमारे चैनल पर जाएं', CHANNEL_LINK)]
  ]));
});

// बटन एक्शन्स
bot.action('about_bot', (ctx) => {
    ctx.reply(`⚙️ **बोट का नाम:** CP Super Poll Maker\n👑 **मालिक:** CP Rawat Sir\n\nयह बोट भारी मात्रा (Bulk) में बिना रुके टेलीग्राम नेटिव पोल बनाने के लिए कस्टमाइज़ किया गया है।`);
});

bot.action('help_format', (ctx) => {
  const helpText = 
    `📖 **प्रश्न पेस्ट करने का सही बुक फॉर्मेट:**\n\n` +
    `Q. मानव शरीर की सबसे बड़ी ग्रंथि कौन सी है?\n` +
    `A) थायराइड\n` +
    `B) यकृत ✅\n` +
    `C) पिट्यूटरी\n` +
    `D) अग्न्याशय\n\n` +
    `व्याख्या: मानव शरीर की सबसे बड़ी ग्रंथि यकृत है।\n\n` +
    `⚠️ **महत्वपूर्ण:** सही विकल्प के ठीक आगे हरा टिक (✅) जरूर लगाएं।`;
  ctx.reply(helpText);
});

bot.action('create_menu', (ctx) => {
    const userId = ctx.from.id.toString();
    if (!authenticatedUsers.has(userId) && !allowedUsers.has(userId)) {
        return ctx.reply('❌ आप अधिकृत नहीं हैं!');
    }
    ctx.reply('आप किस प्रकार का प्रश्न जनरेट करना चाहते हैं?', Markup.inlineKeyboard([
        [Markup.button.callback('🔒 Anonymous (गुप्त - @QuizBot के लिए अनिवार्य)', 'mode_anonymous')],
        [Markup.button.callback('👁️ Public (नाम दिखने वाला साधारण पोल)', 'mode_public')]
    ]));
});

bot.action('mode_anonymous', (ctx) => {
    const userId = ctx.from.id.toString();
    userStates[userId] = 'CREATE_ANONYMOUS';
    ctx.reply('🔒 **Anonymous मोड एक्टिव!** अब अपने प्रश्न सीधे यहाँ पेस्ट करें:');
});

bot.action('mode_public', (ctx) => {
    const userId = ctx.from.id.toString();
    userStates[userId] = 'CREATE_PUBLIC';
    ctx.reply('👁️ **Public मोड एक्टिव!** अब अपने प्रश्न सीधे यहाँ पेस्ट करें:');
});

bot.action('login_bot', (ctx) => {
    userStates[ctx.from.id.toString()] = 'AWAITING_PASSWORD';
    ctx.reply('🔒 बोट का उपयोग करने के लिए मास्टर पासवर्ड दर्ज करें:');
});

// 2. सीक्रेट ओनर कोड और यूजर परमिशन/आईडी फाइंडर सिस्टम
bot.hears('/public cprawat sir @818182', (ctx) => {
  const userId = ctx.from.id.toString();
  allowedUsers.add(userId); 
  authenticatedUsers.add(userId); 
  ctx.reply(`👑 **प्रणाम CP Rawat Sir! मालिक का स्वागत है।**\n\n` +
            `• किसी की आईडी निकालने के लिए उसका कोई भी मैसेज इस बोट पर **फॉरवर्ड** करें।\n` +
            `• उसे परमिशन देने के लिए टाइप करें: \`/allow उसकी_आईडी_या_यूजरनेम\`\n` +
            `• पासवर्ड बदलने के लिए: \`/setpass नया_पासवर्ड\`\n\n` +
            `मेनू खोलने के लिए /start दबाएं।`);
});

bot.on('text', async (ctx, next) => {
  const text = ctx.message.text;
  const userId = ctx.from.id.toString();

  // एडमिन द्वारा किसी को परमिशन देना
  if (text.startsWith('/allow ') && allowedUsers.has(userId)) {
    const target = text.split(' ')[1];
    if (target) {
      allowedUsers.add(target.trim());
      return ctx.reply(`✅ ${target} को बोट इस्तेमाल करने की अनुमति दे दी गई है। अब वे पासवर्ड डालकर बोट चला सकते हैं।`);
    }
  }

  // पासवर्ड बदलना
  if (text.startsWith('/setpass ') && allowedUsers.has(userId)) {
    const newPass = text.split(' ')[1];
    if (newPass) {
      currentPassword = newPass.trim();
      return ctx.reply(`🔐 मास्टर पासवर्ड सफलतापूर्वक बदल गया है। नया पासवर्ड है: \`${currentPassword}\``);
    }
  }

  // पासवर्ड वेरिफिकेशन
  if (userStates[userId] === 'AWAITING_PASSWORD') {
    if (text === currentPassword) {
      authenticatedUsers.add(userId);
      delete userStates[userId];
      return ctx.reply('✅ पासवर्ड सही है! मेनू खोलने के लिए /start दबाएं और काम शुरू करें।');
    } else {
      return ctx.reply('❌ गलत पासवर्ड! कृपया दोबारा प्रयास करें।');
    }
  }

  // क्विज क्रिएशन प्रक्रिया
  if (userStates[userId] === 'CREATE_ANONYMOUS' || userStates[userId] === 'CREATE_PUBLIC') {
      try {
        const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
        if (member.status === 'left' || member.status === 'kicked') {
          return ctx.reply(`🛑 **आगे बढ़ने से पहले चैनल जॉइन करना अनिवार्य है!**\nकृपया पहले मुख्य चैनल जॉइन करें: ${CHANNEL_LINK}`);
        }
      } catch (err) {
        console.log('Force join bypass (Bot not admin in channel)');
      }

      const isAnonymous = userStates[userId] === 'CREATE_ANONYMOUS';
      await parseAndCreateQuizzes(ctx, text, isAnonymous);
      return;
  }

  await next();
});

// 🆔 आईडी फाइंडर सिस्टम (कोई भी मैसेज फॉरवर्ड करने पर तुरंत आईडी और यूजरनेम निकालना)
bot.on('message', async (ctx, next) => {
  if (ctx.message.forward_date) {
    const fromUser = ctx.message.forward_from;
    if (fromUser) {
      const usernameText = fromUser.username ? `@${fromUser.username}` : 'कोई यूजरनेम नहीं है';
      return ctx.reply(`🔍 **फॉरवर्ड किए गए यूजर का डेटा:**\n\n👤 **नाम:** ${fromUser.first_name}\n🆔 **यूजर आईडी:** \`${fromUser.id}\` (क्लिक करके कॉपी करें)\n🌐 **यूजरनेम:** ${usernameText}\n\n👉 इसे परमिशन देने के लिए आप \`/allow ${fromUser.id}\` टाइप कर सकते हैं।`, { parse_mode: 'Markdown' });
    } else {
      return ctx.reply('⚠️ इस यूजर ने टेलीग्राम सेटिंग्स में फॉरवर्ड प्राइवेसी ऑन कर रखी है, इसलिए इसकी डायरेक्ट आईडी नहीं निकाली जा सकती।');
    }
  }
  await next();
});

// 3. एडवांस क्विज पार्सर (व्याख्या में तीनों लिंक को 200 अक्षरों के अंदर फिट करना)
async function parseAndCreateQuizzes(ctx, text, isAnonymous) {
  const rawQuestions = text.split(/(?=Q\.|Q\s|प्रश्न\s|प्र\.)/i);
  let successCount = 0;

  if (rawQuestions.length > 1) {
    ctx.reply(`⏳ आपके प्रश्नों से पोल तैयार किए जा रहे हैं, कृपया प्रतीक्षा करें...`);
  }

  for (const rawQ of rawQuestions) {
    if (!rawQ.trim() || rawQ.trim().length < 10) continue;

    const lines = rawQ.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let question = lines[0];
    let options = [];
    let correctOptionId = -1;
    
    // टेलीग्राम की 200 अक्षरों की लिमिट के लिए एकदम शॉर्ट और सुंदर लिंक स्ट्रक्चर
    let basePromo = `\n📢चैनल:${CHANNEL_LINK}\n💬ग्रुप:${GROUP_LINK}\n🏆क्विज:${QUIZ_CLUB_LINK}`;
    let explanation = `📚 नोट्स व डेली क्विज के लिए जुड़ें:${basePromo}`;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().startsWith('व्याख्या:') || line.toLowerCase().startsWith('explain:')) {
        let ext = line.replace(/व्याख्या:|explain:/i, '').trim();
        
        // यदि व्याख्या लंबी है, तो उसे 70 अक्षरों पर काटें ताकि लिंक्स के लिए जगह बची रहे और टेलीग्राम ब्लॉक न करे
        if (ext.length > 70) ext = ext.substring(0, 67) + '...';
        explanation = `${ext}${basePromo}`;
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
        await new Promise(resolve => setTimeout(resolve, 600)); // टेलीग्राम रेट लिमिट सेफ्टी
      } catch (err) {
        console.error('क्विज जनरेशन एरर:', err.message);
      }
    }
  }
  ctx.reply(`✅ प्रक्रिया पूरी हुई! कुल ${successCount} पोल सफलता पूर्वक तैयार हैं।`);
}

// 4. एक्सप्रेस वेब सर्वर और इन-बिल्ट "24/7 एक्टिवेटर" (Self-Ping System)
const app = express();
app.get('/', (req, res) => res.send('CP Rawat Sir Quiz Engine is Live and Running 24/7!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // 🔄 रेंडर ऐप को हमेशा जगाए रखने का जादुई चक्र
  setInterval(() => {
    const selfUrl = process.env.RENDER_EXTERNAL_URL;
    if (selfUrl) {
      https.get(selfUrl, (res) => {
        console.log(`[Self-Ping] बोट को पिंग किया गया, स्टेटस कोड: ${res.statusCode} - बोट जाग रहा है!`);
      }).on('error', (e) => console.error('[Self-Ping Error]:', e.message));
    }
  }, 10 * 60 * 1000); // हर 10 मिनट में खुद को जगाएगा
});

bot.launch().then(() => {
  console.log('🚀 CP Rawat Sir Super Bot Started and Secured Successfully!');
});
