import { Telegraf, Markup } from 'telegraf';
import 'dotenv/config';

// Render के Environment Variables से टोकन खींचना
const BOT_TOKEN = process.env.BOT_TOKEN;
let currentPassword = process.env.MASTER_PASSWORD || 'CP@2026';

if (!BOT_TOKEN) {
  console.error("Error: BOT_TOKEN is missing!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// डेटाबेस (मेमोरी में)
const allowedUsers = new Set(); // जिन्हें ओनर ने अलाउ किया है
const authenticatedUsers = new Set(); // जिन्होंने सही पासवर्ड डाल दिया है
const userStates = {}; // यूजर्स का करेंट स्टेट (पासवर्ड डालने का इंतज़ार)

// आपकी लिंक्स
const CHANNEL_LINK = 'https://t.me/gkandgs12';
const CHANNEL_USERNAME = '@gkandgs12'; // फोर्स जॉइन चेक करने के लिए
const GROUP_LINK = 'https://t.me/gkandgs85';
const QUIZ_CLUB_LINK = 'https://t.me/QuizClub15seconds';

// 🛑 बोट को क्रैश होने से बचाने के लिए (Anti-Crash System)
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection at:', promise, 'reason:', reason));

// 1. वेलकम मैसेज (सभी पब्लिक यूजर्स के लिए)
bot.start((ctx) => {
  const firstName = ctx.from.first_name;
  
  const welcomeText = 
    `👋 **नमस्कार ${firstName} जी!**\n` +
    `👑 **CP Rawat Sir के "सुपर क्विज मेकर बोट" में आपका स्वागत है!** 🙏✨\n\n` +
    `🚀 **बोट की खासियत:**\n` +
    `यह टेलीग्राम का सबसे एडवांस बोट है। इसकी मदद से आप बुक फॉर्मेट में लिखे प्रश्नों को कॉपी-पेस्ट करके एक साथ **100+ सुपर पोल और क्विज** बना सकते हैं! 🔥\n\n` +
    `🛑 **महत्वपूर्ण नियम:**\n` +
    `इस बोट का इस्तेमाल केवल **अधिकृत (Authorized) एडमिन्स** ही कर सकते हैं।\n\n` +
    `🔗 **हमारे ऑफिशियल प्लेटफॉर्म्स (अभी जॉइन करें):**\n` +
    `📥 **फ्री PDF व नोट्स:** [GK and GS Classes](${CHANNEL_LINK})\n` +
    `💬 **डिस्कशन ग्रुप:** [यहाँ क्लिक करें](${GROUP_LINK})\n` +
    `🏆 **100+ डेली क्विज हब:** [Quiz Club](${QUIZ_CLUB_LINK})\n\n` +
    `⚙️ **निर्माता:** cprawat sir 👑`;

  ctx.replyWithMarkdown(welcomeText, {
    disable_web_page_preview: true,
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔐 बोट का इस्तेमाल करें (Login)', 'login_bot')],
      [Markup.button.url('📢 जॉइन ऑफिशियल चैनल', CHANNEL_LINK)],
      [Markup.button.callback('❓ हेल्प / फॉर्मेट सीखें', 'help_format')]
    ])
  });
});

// हेल्प बटन
bot.action('help_format', (ctx) => {
  const helpText = 
    `📖 **प्रश्न पेस्ट करने का बुक फॉर्मेट:**\n\n` +
    `Q. मानव शरीर की सबसे बड़ी ग्रंथि कौन सी है? (UPSC 2026)\n` +
    `A) थायराइड\n` +
    `B) यकृत ✅\n` +
    `C) पिट्यूटरी\n` +
    `D) अग्न्याशय\n\n` +
    `व्याख्या: मानव शरीर की सबसे बड़ी ग्रंथि यकृत है।\n\n` +
    `⚠️ **नोट:** सही उत्तर के आगे हरा टिक (✅) लगाना ज़रूरी है।`;
  ctx.reply(helpText);
});

// लॉगिन सिस्टम
bot.action('login_bot', (ctx) => {
  const username = ctx.from.username ? `@${ctx.from.username}` : null;
  const userId = ctx.from.id.toString();

  if (allowedUsers.has(username) || allowedUsers.has(userId)) {
    if (authenticatedUsers.has(userId)) {
      ctx.reply('🆕 आप पहले से लॉग इन हैं! कृपया अपने प्रश्न पेस्ट करें।');
    } else {
      userStates[userId] = 'AWAITING_PASSWORD';
      ctx.reply('🔒 कृपया मास्टर पासवर्ड दर्ज करें:');
    }
  } else {
    ctx.answerCbQuery('❌ आप इस बोट को इस्तेमाल करने के लिए अधिकृत नहीं हैं!', { show_alert: true });
  }
});

// 2. सीक्रेट ओनर कमांड (/public cprawat sir @818182)
bot.hears('/public cprawat sir @818182', (ctx) => {
  const userId = ctx.from.id.toString();
  allowedUsers.add(userId); 
  authenticatedUsers.add(userId); // ओनर को सीधा एक्सेस
  
  ctx.reply(
    `👑 **प्रणाम CP Rawat Sir! एडमिन कंट्रोल पैनल एक्टिव हो गया है।**\n\n` +
    `• एक्सेस देने के लिए: \`/allow @username\` या \`/allow UserID\`\n` +
    `• पासवर्ड बदलने के लिए: \`/setpass नया_पासवर्ड\`\n` +
    `• वर्तमान पासवर्ड: \`${currentPassword}\`\n\n` +
    `🆕 आप सीधे प्रश्न (बुक फॉर्मेट) पेस्ट करके क्विज बना सकते हैं।`,
    { parse_mode: 'Markdown' }
  );
});

// ओनर कमांड्स, पासवर्ड चेकिंग और आईडी फाइंडर
bot.on('text', async (ctx, next) => {
  const text = ctx.message.text;
  const userId = ctx.from.id.toString();

  // आईडी फाइंडर (कोई भी मैसेज फॉरवर्ड करने पर आईडी देना)
  if (ctx.message.forward_date) {
    const forwardedFrom = ctx.message.forward_from;
    if (forwardedFrom) {
      return ctx.reply(`🔍 **यूज़र की जानकारी:**\n👤 नाम: ${forwardedFrom.first_name}\n🆔 आईडी: \`${forwardedFrom.id}\``, { parse_mode: 'Markdown' });
    }
  }

  // ओनर कमांड: Allow User
  if (text.startsWith('/allow ') && allowedUsers.has(userId)) {
    const target = text.split(' ')[1];
    if (target) {
      allowedUsers.add(target.trim());
      return ctx.reply(`✅ ${target} को एक्सेस दे दिया गया है।`);
    }
  }

  // ओनर कमांड: Set Password
  if (text.startsWith('/setpass ') && allowedUsers.has(userId)) {
    const newPass = text.split(' ')[1];
    if (newPass) {
      currentPassword = newPass.trim();
      return ctx.reply(`🔐 मास्टर पासवर्ड बदल गया है। नया पासवर्ड: \`${currentPassword}\``, { parse_mode: 'Markdown' });
    }
  }

  // पासवर्ड चेक करना
  if (userStates[userId] === 'AWAITING_PASSWORD') {
    if (text === currentPassword) {
      authenticatedUsers.add(userId);
      delete userStates[userId];
      return ctx.reply('✅ पासवर्ड सही है! आपका एक्सेस अनलॉक हो गया है। अब अपने प्रश्न पेस्ट करें।');
    } else {
      return ctx.reply('❌ गलत पासवर्ड! प्रयास करें।');
    }
  }

  // 3. फोर्स जॉइन चेक और क्विज क्रिएशन (सिर्फ ऑथेंटिकेटेड यूजर्स के लिए)
  if (authenticatedUsers.has(userId)) {
    try {
      // चेक करें कि क्या यूजर चैनल का मेंबर है?
      const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
      if (member.status === 'left' || member.status === 'kicked') {
        return ctx.reply(`🛑 **क्विज बनाने से पहले चैनल जॉइन करना अनिवार्य है!**\nकृपया पहले ${CHANNEL_LINK} जॉइन करें।`);
      }
    } catch (err) {
      console.log('Force join check error:', err.message);
      // अगर बोट चैनल में एडमिन नहीं है, तो एरर इग्नोर करें
    }

    // बल्क क्विज जनरेटर
    parseAndCreateQuizzes(ctx, text);
    return;
  }

  await next();
});

// 4. सुपर बुक-फॉर्मेट पार्सर
async function parseAndCreateQuizzes(ctx, text) {
  const rawQuestions = text.split(/(?=Q\.|Q\s|प्रश्न\s|प्र\.)/i);
  let successCount = 0;

  if (rawQuestions.length > 1) {
    ctx.reply(`⏳ क्विज बनाई जा रही हैं, कृपया प्रतीक्षा करें...`);
  }

  for (const rawQ of rawQuestions) {
    if (!rawQ.trim() || rawQ.trim().length < 10) continue;

    const lines = rawQ.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let question = lines[0];
    let options = [];
    let correctOptionId = -1;
    
    // टेलीग्राम की एक्सप्लेनेशन लिमिट (200 कैरेक्टर) का ध्यान रखते हुए शॉर्ट लिंक्स
    let explanation = `📚 नोट्स: [GK&GS](${CHANNEL_LINK}) | 🏆 क्विज: [Quiz Club](${QUIZ_CLUB_LINK})`;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      // व्याख्या ढूंढना
      if (line.toLowerCase().startsWith('व्याख्या:') || line.toLowerCase().startsWith('explain:')) {
        let ext = line.replace(/व्याख्या:|explain:/i, '').trim();
        // अगर व्याख्या बहुत बड़ी है, तो उसे छोटा कर दें ताकि लिंक्स आ सकें
        if (ext.length > 100) ext = ext.substring(0, 100) + '...';
        explanation = `${ext}\n\n📢 [GK&GS](${CHANNEL_LINK}) | 🏆 [Quiz](${QUIZ_CLUB_LINK})`;
        break;
      }

      // विकल्प ढूंढना (A, B, C, D)
      if (line.match(/^[A-D]\)|^[A-D]\.|^[1-4]\)|^[1-4]\./i)) {
        let cleanOption = line.replace(/^[A-D]\)|^[A-D]\.|^[1-4]\)|^[1-4]\./i, '').trim();
        
        if (line.includes('✅')) {
          cleanOption = cleanOption.replace('✅', '').trim();
          correctOptionId = options.length;
        }
        options.push(cleanOption);
      }
    }

    // क्विज बनाना (Native Mode for @QuizBot Forwarding)
    if (options.length >= 2 && options.length <= 10 && correctOptionId !== -1) {
      try {
        await ctx.replyWithQuiz(question, options, {
          correct_option_id: correctOptionId,
          explanation: explanation,
          explanation_parse_mode: 'Markdown',
          is_anonymous: true // ऑफिशियल बोट के लिए यह true होना अनिवार्य है
        });
        successCount++;
        // स्पैम से बचने के लिए थोड़ा डिले (Telegram Rate Limit)
        await new Promise(resolve => setTimeout(resolve, 500)); 
      } catch (err) {
        console.error('क्विज जनरेशन एरर:', err.message);
      }
    }
  }

  if (successCount > 0) {
    ctx.reply(`✅ ${successCount} क्विज सफलतापूर्वक तैयार! अब आप इन्हें @QuizBot या किसी भी ग्रुप में फॉरवर्ड कर सकते हैं।`);
  }
}

// 5. ऑटो-प्रमोशन सिस्टम (हर 12 घंटे में आपके ग्रुप में मैसेज)
setInterval(async () => {
  try {
    const promoText = 
      `🌟 **प्रिय छात्रों! अपनी तैयारी को और मजबूत बनाएं!** 🌟\n\n` +
      `📚 **GK and GS Classes** पर पाएं फ्री PDF और नोट्स।\n\n` +
      `👉 [चैनल जॉइन करें](${CHANNEL_LINK})\n` +
      `👉 [100+ क्विज लगाएं](${QUIZ_CLUB_LINK})`;
    
    // ग्रुप में भेजना (बोट को @gkandgs85 में एडमिन होना चाहिए)
    await bot.telegram.sendMessage('@gkandgs85', promoText, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (error) {
    console.log('Auto-promo error (Bot admin nahi hai):', error.message);
  }
}, 12 * 60 * 60 * 1000); // 12 घंटे

// बोट स्टार्ट
bot.launch().then(() => {
  console.log('🚀 CP Rawat Sir Super Bot Started Successfully!');
});

