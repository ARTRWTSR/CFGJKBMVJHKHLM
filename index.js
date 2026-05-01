import express from 'express';
import { spawn } from 'child_process';
import { google } from 'googleapis';
import PQueue from 'p-queue';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const queue = new PQueue({ concurrency: 1 });
const jobs = new Map();

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/drive.file']
);

const processTransfer = async (jobId, url, folderId) => {
  const job = jobs.get(jobId);
  job.status = 'processing';

  return new Promise((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', [
      '--newline',
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--max-filesize', '250M',
      '-o', '-', 
      url
    ]);

    const timeout = setTimeout(() => { ytdlp.kill('SIGKILL'); reject(new Error('Timeout')); }, 600000);

    ytdlp.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/(\d+\.\d+)%/);
      if (match) job.progress = parseFloat(match[1]);
    });

    drive.files.create({
      requestBody: { name: `Cloud_${jobId}.mp4`, parents: [folderId] },
      media: { mimeType: 'video/mp4', body: ytdlp.stdout },
    }).then(() => {
      clearTimeout(timeout);
      job.status = 'completed';
      job.progress = 100;
      resolve();
    }).catch(err => {
      clearTimeout(timeout);
      ytdlp.kill('SIGKILL');
      reject(err);
    });
  });
};

app.post('/upload', (req, res) => {
  const { url, folderId } = req.body;
  const jobId = uuidv4();
  jobs.set(jobId, { status: 'queued', progress: 0, timestamp: Date.now() });
  queue.add(() => processTransfer(jobId, url, folderId).catch(err => {
    const j = jobs.get(jobId);
    if (j) { j.status = 'failed'; j.error = err.message; }
  }));
  res.status(202).json({ jobId });
});

app.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json(job);
});

app.listen(3000, () => console.log('🚀 Server Running'));
