const express = require('express');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const puppeteer = require('puppeteer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// 設定 EJS 模板與靜態資源
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/static', express.static(path.join(__dirname, 'static')));

// 🔍 擷取影片標題與演出者資訊
async function fetchVideoMetadata(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await res.text();
    const titleMatch = html.match(/<meta name="title" content="(.*?)">/);
    const artistMatch = html.match(/<link itemprop="name" content="(.*?)">/);

    const title = titleMatch ? titleMatch[1] : "未知標題";
    const artist = artistMatch ? artistMatch[1] : "未知演出者";
    return { title, artist };
  } catch (err) {
    return { title: "未知標題", artist: "未知演出者" };
  }
}

// 📄 HTML 預覽卡片（供 Puppeteer 截圖使用）
app.get('/preview/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const { title, artist } = req.query;

  res.render('card', {
    videoId,
    title,
    artist,
    artwork: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    ytmUrl: `https://music.youtube.com/watch?v=${videoId}`
  });
});

// 📸 動態生成 PNG 貼紙
app.get('/badge/:videoId.png', async (req, res) => {
  const { videoId } = req.params;
  const { title: queryTitle, artist: queryArtist } = req.query;

  let title = queryTitle;
  let artist = queryArtist;

  if (!title || !artist) {
    const meta = await fetchVideoMetadata(videoId);
    title = title || meta.title;
    artist = artist || meta.artist;
  }

  // 📡 用 request 自動組出完整網址，讓 puppeteer 可在 Render 環境中存取
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl}/preview/${videoId}?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 240, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle0' });

    const buffer = await page.screenshot({ type: 'png' });
    await browser.close();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);

  } catch (err) {
    console.error('🐛 Puppeteer error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// 🧪 預覽頁面測試用
app.get('/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const queryTitle = req.query.title;
  const queryArtist = req.query.artist;

  let title = queryTitle;
  let artist = queryArtist;

  if (!title || !artist) {
    const meta = await fetchVideoMetadata(videoId);
    title = title || meta.title;
    artist = artist || meta.artist;
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const cardImage = `${baseUrl}/badge/${videoId}.png?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;

  res.render('embed', {
    videoId,
    title,
    artist,
    artwork: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    ytmUrl: `https://music.youtube.com/watch?v=${videoId}`,
    ytUrl: `https://www.youtube.com/watch?v=${videoId}`,
    cardImage
  });
});

app.listen(PORT, () => {
  console.log(`🎶 Embed badge server running at http://localhost:${PORT}`);
});
