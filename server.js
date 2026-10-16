const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let applicants = [];
let blacklist = [];
let deviceApprovals = [];
let announcement = "";
let systemSettings = { examOpen: true, autoApprove: false };

let adminStats = [
  { username: "superadmin", name: "مدير الإدارة العليا", gameId: "1", points: 0, approvals: 0 },
  { username: "examiner", name: "مسؤول اختبارات", gameId: "2", points: 0, approvals: 0 }
];

app.get('/', (req, res) => { res.redirect('/login.html'); });

app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password, gameId, deviceId } = req.body;
    let role = "";
    let name = "";

    if (username === "superadmin" && password === "super2026") {
      role = "superadmin"; name = "مدير الإدارة العليا";
    } else if (username === "examiner" && password === "exam123") {
      role = "examiner"; name = "مسؤول اختبارات";
    } else {
      return res.status(401).json({ success: false, message: "بيانات المسؤول غير صحيحة" });
    }

    let admin = adminStats.find(a => a.username === username);
    const finalGameId = (gameId && String(gameId).trim() !== "") ? String(gameId).trim() : (admin ? admin.gameId : "غير محدد");
    if (admin) admin.gameId = finalGameId;

    const currentDeviceId = deviceId || 'unknown_device';
    let device = deviceApprovals.find(d => d.deviceId === currentDeviceId);

    if (role === "superadmin") {
      if (!device) {
        device = { deviceId: currentDeviceId, username, gameId: finalGameId, status: "approved", note: "", date: new Date().toISOString() };
        deviceApprovals.push(device);
      } else {
        device.status = "approved"; device.gameId = finalGameId; device.username = username;
      }
      return res.json({ success: true, role, name, username, gameId: finalGameId });
    }

    if (!device || (device.gameId && device.gameId !== finalGameId && device.status === 'rejected')) {
      if (device) deviceApprovals = deviceApprovals.filter(d => d.deviceId !== currentDeviceId);
      device = { deviceId: currentDeviceId, username, gameId: finalGameId, status: "pending", note: "", date: new Date().toISOString() };
      deviceApprovals.push(device);
      return res.json({ success: false, pendingDevice: true, message: "جهازك قيد الانتظار لموافقة مدير الإدارة العليا." });
    }

    device.gameId = finalGameId;
    device.username = username;

    if (device.status === "rejected") {
      return res.status(403).json({ success: false, message: `❌ تم رفض جهازك من قبل الإدارة العليا.` });
    }
    if (device.status === "pending") {
      return res.json({ success: false, pendingDevice: true, message: "جهازك قيد الانتظار لموافقة مدير الإدارة العليا." });
    }

    res.json({ success: true, role, name, username, gameId: finalGameId });
  } catch (err) { res.status(500).json({ success: false, message: "خطأ في السيرفر" }); }
});

app.get('/api/admin/data', (req, res) => {
  try {
    const sortedAdmins = [...adminStats].sort((a, b) => b.approvals - a.approvals || b.points - a.points);
    res.json({ applicants, blacklist, devices: deviceApprovals, adminStats: sortedAdmins, settings: systemSettings, announcement });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/set-announcement', (req, res) => {
  try { announcement = req.body.text || ""; res.json({ success: true, announcement }); } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/add-blacklist', (req, res) => {
  try {
    const { discord, gameId, reason } = req.body;
    if (!gameId) return res.status(400).json({ success: false, message: "أيدي اللعبة مطلوب!" });
    const cleanGameId = String(gameId).trim();
    blacklist = blacklist.filter(b => b.gameId !== cleanGameId);
    blacklist.push({ id: Date.now(), discord: discord ? String(discord).trim() : 'غير محدد', gameId: cleanGameId, reason: reason ? String(reason).trim() : 'مخالفة القوانين' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/remove-blacklist', (req, res) => {
  try { blacklist = blacklist.filter(b => b.gameId !== String(req.body.gameId).trim()); res.json({ success: true }); } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/change-admin-gameid', (req, res) => {
  try {
    const { username, newGameId } = req.body;
    let admin = adminStats.find(a => a.username === username);
    if (admin) { 
      admin.gameId = newGameId; 
      deviceApprovals.forEach(d => { if (d.username === username) d.gameId = newGameId; });
      return res.json({ success: true }); 
    }
    res.status(404).json({ success: false });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/update-points', (req, res) => {
  try {
    const { targetType, idOrUser, pointsChange } = req.body;
    if (targetType === 'admin') {
      let admin = adminStats.find(a => a.username === idOrUser);
      if (admin) { admin.points += pointsChange; return res.json({ success: true }); }
    } else if (targetType === 'applicant') {
      let appItem = applicants.find(a => a.id === Number(idOrUser));
      if (appItem) { appItem.score = Math.max(0, (appItem.score || 0) + pointsChange); return res.json({ success: true }); }
    }
    res.status(404).json({ success: false });
  } catch (err) { res.status(500).json({ success: false }); }
});

// مسار اتخاذ القرارات (قبول، رفض، فصل)
app.post('/api/admin/decision', async (req, res) => {
  try {
    const { applicantId, status, adminNote, addToBlacklist, adminUsername } = req.body;
    const appItem = applicants.find(a => a.id === Number(applicantId));
    
    if (appItem) {
      appItem.status = status;
      appItem.adminNote = adminNote;
      
      if (status === 'مقبول') {
        let admin = adminStats.find(a => a.username === adminUsername);
        if (admin) { admin.approvals += 1; admin.points += 10; }
      }
      
      if (addToBlacklist && !blacklist.find(b => b.gameId === appItem.gameId)) {
        blacklist.push({ discord: appItem.discord, gameId: appItem.gameId, reason: adminNote || 'مخالفة القوانين' });
      }

      // استخراج الأيدي الرقمي النظيف للديسكورد وتمريره للبوت
      let rawDiscordId = appItem.discordId || appItem.discord;
      let cleanDiscordId = String(rawDiscordId).replace(/\D/g, '');

      if (cleanDiscordId) {
        try {
          await fetch('http://localhost:3001/bot/update-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              discordId: cleanDiscordId, 
              status: status, 
              adminUsername: adminUsername || 'الإدارة',
              adminNote: adminNote || 'لا يوجد سبب محدد'
            })
          });
        } catch (botErr) {
          console.log("تعذر الاتصال ببوت ديسكورد المحلي:", botErr.message);
        }
      }

      return res.json({ success: true });
    }
    res.status(404).json({ success: false });
  } catch (err) { 
    console.error("Decision Error:", err);
    res.status(500).json({ success: false }); 
  }
});

app.post('/api/admin/toggle-exam', (req, res) => {
  try { systemSettings.examOpen = req.body.examOpen; res.json({ success: true, examOpen: systemSettings.examOpen }); } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/submit-exam', (req, res) => {
  try {
    if (!systemSettings.examOpen) return res.status(403).json({ success: false });
    applicants.push({ id: Date.now(), ...req.body, status: "قيد المراجعة", date: new Date().toISOString() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/device-decision', (req, res) => {
  try {
    const { deviceId, status, note } = req.body;
    const device = deviceApprovals.find(d => d.deviceId === deviceId);
    if (device) { 
      if (status) device.status = status; 
      if (note !== undefined) device.note = note;
      return res.json({ success: true }); 
    }
    res.status(404).json({ success: false });
  } catch (err) { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Wink Admin System running on http://localhost:3000`));