const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// تجاوز فحص ملفات الحزم الخارجية لمنع خطأ package.json
process.env.NODE_NO_WARNINGS = '1';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    let targetFile = req.url === '/' ? 'index.html' : req.url;
    let filePath = path.join(__dirname, targetFile);
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 - الملف غير موجود في المجلد</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`خطأ في السيرفر: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log('==================================================');
    console.log(`🚀 تم تشغيل سيرفر الأكاديمية بنجاح عبر سطر الأوامر!`);
    console.log(`🌐 افتح الرابط التالي في المتصفح: http://localhost:${PORT}`);
    console.log('==================================================');
});