const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = "MTIwOTAzMjg2MTY2ODIyMDkzOA.GN11B0.qg9ltrJVsI-DT3YCo8SYaxLqSX-pqhjQbIXkf8";
const GUILD_ID = "1394522711526740118"; 

const ACCEPTED_ROLE_ID = "1560701862561185842"; 
const REJECTED_ROLE_ID = "1560701893016031282";

client.once('ready', () => {
  console.log(`🤖 تم تشغيل بوت ديسكورد المرتبط بالموقع بنجاح باسم: ${client.user.tag}`);
});

app.post('/bot/update-roles', async (req, res) => {
  try {
    let { discordId, status, adminUsername, adminNote } = req.body;
    if (!discordId) return res.status(400).json({ success: false, message: "Discord ID missing" });

    const cleanId = String(discordId).replace(/\D/g, '');
    if (!cleanId) return res.status(400).json({ success: false, message: "Invalid Discord ID format" });

    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return res.status(404).json({ success: false, message: "Guild not found" });

    const member = await guild.members.fetch(cleanId).catch(() => null);
    if (!member) return res.status(404).json({ success: false, message: "Member not found in discord server" });

    if (status === 'مقبول') {
      await member.roles.add(ACCEPTED_ROLE_ID).catch(() => {});
      await member.roles.remove(REJECTED_ROLE_ID).catch(() => {});
      
      await member.send({
        content: `🎉 **مرحباً بك في إدارة WINK!**\n\nيسعدنا إبلاغك بأنه **تم قبولك رسمياً**، ونرحب بك أشد الترحيب بين إخوانك وزملائك في الإدارة. نتمنى لك التوفيق! 🚀`
      }).catch(() => {});

      console.log(`✅ تم إعطاء رتبة القبول للعضو: ${member.user.tag}`);
    } 
    else if (status === 'مرفوض') {
      await member.roles.add(REJECTED_ROLE_ID).catch(() => {});
      await member.roles.remove(ACCEPTED_ROLE_ID).catch(() => {});
      console.log(`❌ تم إعطاء رتبة الرفض للعضو: ${member.user.tag}`);
    } 
    else if (status === 'مفصول') {
      // إزالة رتبة القبول وإضافة رتبة الرفض وإرسال رسالة الطرد الخاصة
      await member.roles.remove(ACCEPTED_ROLE_ID).catch(() => {});
      await member.roles.add(REJECTED_ROLE_ID).catch(() => {});

      await member.send({
        content: `🚨 **إشعار فصل وتعديل حالة من إدارة WINK**\n\nعفواً، لقد تم **فصلك / إزالتك** من الإدارة.\n👤 **الإداري المسؤول:** ${adminUsername || 'الإدارة'}\n📝 **سبب الفصل:** ${adminNote || 'مخالفة الأنظمة والتعليمات'}`
      }).catch(err => console.log("تعذر إرسال رسالة خاصه للعضو (الخاص مغلق):", err.message));

      console.log(`🚨 تم فصل العضو وإرسال سبب الفصل في الخاص: ${member.user.tag}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Bot API Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(3001, () => console.log('Bot internal server running on port 3001'));
client.login(TOKEN);