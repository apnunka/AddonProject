const { addonBuilder } = require('stremio-addon-sdk');
const axios = require('axios');

const builder = new addonBuilder({
  id: 'org.cinestream.stremio.addon',
  version: '1.0.0',
  name: 'CineStream',
  description: 'Hindi & English Movies and Series',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: []
});

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://vidsrc.icu/',
  'Origin': 'https://vidsrc.icu'
};

async function getVidsrcStreams(imdbId, type, season, episode) {
  const streams = [];
  try {
    let apiUrl;
    if (type === 'movie') {
      apiUrl = `https://vidsrc.icu/api/movie/${imdbId}`;
    } else {
      apiUrl = `https://vidsrc.icu/api/tv/${imdbId}/${season}/${episode}`;
    }

    const { data } = await axios.get(apiUrl, {
      headers: HEADERS,
      timeout: 15000
    });

    if (!data || !data.sources) return streams;

    for (const source of data.sources) {
      if (!source.url) continue;
      streams.push({
        name: `CineStream | ${source.quality || 'HD'}`,
        title: `🎬 ${source.label || 'Stream'}`,
        url: source.url,
        behaviorHints: { notWebReady: false }
      });
    }
  } catch (e) {
    console.log('VidSrc ICU error:', e.message);
  }
  return streams;
}

async function getBackupStreams(imdbId, type, season, episode) {
  const streams = [];
  try {
    let apiUrl;
    if (type === 'movie') {
      apiUrl = `https://vidsrc.xyz/api/movie?imdb=${imdbId}`;
    } else {
      apiUrl = `https://vidsrc.xyz/api/tv?imdb=${imdbId}&s=${season}&e=${episode}`;
    }

    const { data } = await axios.get(apiUrl, {
      headers: { 'User-Agent': HEADERS['User-Agent'] },
      timeout: 15000
    });

    if (!data || !data.url) return streams;

    streams.push({
      name: 'CineStream | Backup HD',
      title: '🎬 Backup Stream',
      url: data.url,
      behaviorHints: { notWebReady: false }
    });
  } catch (e) {
    console.log('Backup error:', e.message);
  }
  return streams;
}

builder.defineStreamHandler(async ({ type, id }) => {
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1] || '1';
  const episode = parts[2] || '1';

  console.log(`Getting streams for ${imdbId} (${type})`);

  const [main, backup] = await Promise.allSettled([
    getVidsrcStreams(imdbId, type, season, episode),
    getBackupStreams(imdbId, type, season, episode)
  ]);

  const streams = [
    ...(main.status === 'fulfilled' ? main.value : []),
    ...(backup.status === 'fulfilled' ? backup.value : [])
  ];

  console.log(`Found ${streams.length} streams for ${imdbId}`);
  return { streams };
});

module.exports = builder.getInterface();
