
const express = require('express');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const puppeteer = require('puppeteer');
const fs = require('fs');
const app = express();
const PORT = 8080;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/static', express.static(path.join(__dirname, 'static')));

async function fetchVideoMetadata(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await res.text();
    const titleMatch = html.match(/<meta name=\"title\" content=\"(.*?)\">/);
    const artistMatch = html.match(/<link itemprop=\"name\" content=\"(.*?)\">/);

    const title = titleMatch ? titleMatch[1] : "未知標題";
    const artist = artistMatch ? artistMatch[1] : "未知演出者";
    return { title, artist };
  } catch (err) {
    return { title: "未知標題", artist: "未知演出者" };
  }
}

// HTML 預覽卡片（渲染成圖片）
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

  const url = `http://localhost:${PORT}/preview/${videoId}?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 240, deviceScaleFactor: 2 });
  await page.goto(url);

  const buffer = await page.screenshot({ type: 'png' });
  await browser.close();

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(buffer);
});

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

  res.render('embed', {
    videoId,
    title,
    artist,
    artwork: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    ytmUrl: `https://music.youtube.com/watch?v=${videoId}`,
    ytUrl: `https://www.youtube.com/watch?v=${videoId}`,
    cardImage: `http://localhost:${PORT}/badge/${videoId}.png?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`
  });
});

app.listen(PORT, () => {
  console.log(`🎶 Embed badge server running at http://localhost:${PORT}`);
});
