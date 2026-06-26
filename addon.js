const { addonBuilder } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

// ── Manifest ──────────────────────────────────────────────
const builder = new addonBuilder({
  id: 'org.cinestream.stremio.addon',
  version: '1.0.0',
  name: 'CineStream',
  description: 'Hindi & English Movies and Series from CineStream sources',
  logo: 'https://raw.githubusercontent.com/SaurabhKaperwan/CSX/master/CineStream/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: []
});

// ── Helpers ────────────────────────────────────────────────
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchMeta(imdbId, type) {
  try {
    const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`;
    const { data } = await axios.get(url, { timeout: 8000 });
    return {
      title: data.meta.name,
      year: data.meta.year || ''
    };
  } catch {
    return null;
  }
}

// ── Source 1: VegaMovies ───────────────────────────────────
async function scrapeVegaMovies(title, type, season, episode) {
  const streams = [];
  try {
    const searchUrl = `https://vegamovies.mov/?s=${encodeURIComponent(title)}`;
    const { data } = await axios.get(searchUrl, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(data);

    const results = [];
    $('article.post').each((i, el) => {
      const link = $(el).find('a').first().attr('href');
      const name = $(el).find('h2, h3').first().text().trim();
      if (link && name.toLowerCase().includes(title.toLowerCase().split(' ')[0])) {
        results.push({ link, name });
      }
    });

    if (!results.length) return streams;
    const postUrl = results[0].link;
    const { data: postData } = await axios.get(postUrl, { headers: HEADERS, timeout: 10000 });
    const $post = cheerio.load(postData);

    $post('a[href]').each((i, el) => {
      const href = $post(el).attr('href') || '';
      const text = $post(el).text().trim();
      if (href.match(/\.(mp4|mkv|m3u8)/i) || href.includes('gdflix') || href.includes('driveleech')) {
        streams.push({
          name: 'CineStream | VegaMovies',
          title: text || 'Stream',
          url: href,
          behaviorHints: { notWebReady: false }
        });
      }
    });
  } catch (e) {
    console.log('VegaMovies error:', e.message);
  }
  return streams;
}

// ── Source 2: MoviesDrive ──────────────────────────────────
async function scrapeMoviesDrive(title, type, season, episode) {
  const streams = [];
  try {
    const searchUrl = `https://moviesdrive.forum/?s=${encodeURIComponent(title)}`;
    const { data } = await axios.get(searchUrl, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(data);

    const results = [];
    $('h2.wpt-title a, h3 a, .entry-title a').each((i, el) => {
      const link = $(el).attr('href');
      const name = $(el).text().trim();
      if (link && name.toLowerCase().includes(title.toLowerCase().split(' ')[0])) {
        results.push({ link, name });
      }
    });

    if (!results.length) return streams;
    const { data: postData } = await axios.get(results[0].link, { headers: HEADERS, timeout: 10000 });
    const $post = cheerio.load(postData);

    $post('a[href]').each((i, el) => {
      const href = $post(el).attr('href') || '';
      const text = $post(el).text().trim();
      if (href.match(/\.(mp4|mkv|m3u8)/i) || text.match(/download|480p|720p|1080p/i)) {
        streams.push({
          name: 'CineStream | MoviesDrive',
          title: text || 'Stream',
          url: href,
          behaviorHints: { notWebReady: false }
        });
      }
    });
  } catch (e) {
    console.log('MoviesDrive error:', e.message);
  }
  return streams;
}

// ── Source 3: Moviesmod ────────────────────────────────────
async function scrapeMoviesmod(title, type, season, episode) {
  const streams = [];
  try {
    const searchUrl = `https://moviesmod.com/?s=${encodeURIComponent(title)}`;
    const { data } = await axios.get(searchUrl, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(data);

    const results = [];
    $('.result-item article a').each((i, el) => {
      const link = $(el).attr('href');
      const name = $(el).text().trim();
      if (link) results.push({ link, name });
    });
    // fallback selector
    if (!results.length) {
      $('h2 a, h3 a').each((i, el) => {
        const link = $(el).attr('href');
        const name = $(el).text().trim();
        if (link && name.toLowerCase().includes(title.toLowerCase().split(' ')[0])) {
          results.push({ link, name });
        }
      });
    }

    if (!results.length) return streams;
    const { data: postData } = await axios.get(results[0].link, { headers: HEADERS, timeout: 10000 });
    const $post = cheerio.load(postData);

    $post('a[href]').each((i, el) => {
      const href = $post(el).attr('href') || '';
      const text = $post(el).text().trim();
      if (href.match(/\.(mp4|mkv|m3u8)/i) || text.match(/480p|720p|1080p|4k/i)) {
        streams.push({
          name: 'CineStream | Moviesmod',
          title: text || 'Stream',
          url: href,
          behaviorHints: { notWebReady: false }
        });
      }
    });
  } catch (e) {
    console.log('Moviesmod error:', e.message);
  }
  return streams;
}

// ── Stream Handler ─────────────────────────────────────────
builder.defineStreamHandler(async ({ type, id }) => {
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1] || null;
  const episode = parts[2] || null;

  const meta = await fetchMeta(imdbId, type);
  if (!meta) return { streams: [] };

  const title = meta.title;
  console.log(`Searching for: ${title} (${type})`);

  // Run all scrapers in parallel
  const [vega, drive, mod] = await Promise.allSettled([
    scrapeVegaMovies(title, type, season, episode),
    scrapeMoviesDrive(title, type, season, episode),
    scrapeMoviesmod(title, type, season, episode),
  ]);

  const streams = [
    ...(vega.status === 'fulfilled' ? vega.value : []),
    ...(drive.status === 'fulfilled' ? drive.value : []),
    ...(mod.status === 'fulfilled' ? mod.value : []),
  ];

  console.log(`Found ${streams.length} streams for ${title}`);
  return { streams };
});

module.exports = builder.getInterface();
