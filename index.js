const { spawn } = require('child_process');
const { google } = require('googleapis');
const { PassThrough } = require('stream');

async function downloadAndUpload(videoUrl, folderId) {
    console.log(`🚀 מתחיל תהליך עבור: ${videoUrl}`);

    // 1. הגדרת הצינור (PassThrough Stream)
    const bridgeStream = new PassThrough();

    // 2. הפעלת yt-dlp כמנוע הזרמה
    // שימוש בפורמט mpegts מאפשר הזרמה חיה יציבה לתוך הצינור
    const ytdlp = spawn('yt-dlp', [
        '-f', 'bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
        '--cookies', '/etc/secrets/cookies.txt', // נתיב הסודות ב-Render
        '-o', '-', // פלט ל-Standard Output (הצינור)
        videoUrl
    ]);

    // חיבור הפלט של yt-dlp לצינור שלנו
    ytdlp.stdout.pipe(bridgeStream);

    // לוגים לניטור התקדמות המנוע
    ytdlp.stderr.on('data', (data) => {
        console.log(`דיווח מנוע: ${data.toString().trim()}`);
    });

    try {
        // 3. הגדרת חיבור ל-Google Drive
        const auth = new google.auth.GoogleAuth({
            keyFile: './service-account.json', // ודא שהקובץ קיים בתיקיית השורש
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });
        const drive = google.drive({ version: 'v3', auth });

        console.log("☁️ מתחיל העלאה ל-Google Drive...");

        // 4. ביצוע ההעלאה בפועל
        const response = await drive.files.create({
            requestBody: {
                name: `video_${Date.now()}.mp4`,
                parents: ['1lsQxAHgIJcugQpo5eho-TDO6vVb2ukl5'], // הכנסת את ה-ID כאן
            },
            media: {
                mimeType: 'video/mp4',
                body: bridgeStream,
            },
            fields: 'id, name',
        });

        console.log(`✅ הצלחה! הקובץ הועלה. ID: ${response.data.id}`);
        return response.data;

    } catch (error) {
        console.error("❌ שגיאה בתהליך ההעלאה:", error.message);
        if (error.response) {
            console.error("פרטי שגיאה מגוגל:", error.response.data);
        }
        throw error;
    }
}
