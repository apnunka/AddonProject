const { addonBuilder } = require('stremio-addon-sdk');
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const API_BASE = 'https://cinestream-api.p.rapidapi.com';

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

async function getTmdbId(imdbId, type) {
  try {
    const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=8d6d91941230817f7807d643736e8a49&external_source=imdb_id`;
    const { data } = await axios.get(url, { timeout: 8000 });
    if (type === 'movie' && data.movie_results && data.movie_results[0]) {
      return data.movie_results[0].id;
    }
    if (type === 'series' && data.tv_results && data.tv_results[0]) {
      return data.tv_results[0].id;
    }
    return null;
  } catch (e) {
    console.log('TMDB error:', e.message);
    return null;
  }
}

builder.defineStreamHandler(async ({ type, id }) => {
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1] || '1';
  const episode = parts[2] || '1';

  console.log(`Getting streams for ${imdbId} (${type})`);

  try {
    const tmdbId = await getTmdbId(imdbId, type);
    if (!tmdbId) {
      console.log('Could not get TMDB ID');
      return { streams: [] };
    }

    console.log(`TMDB ID: ${tmdbId}`);

    let endpoint;
    if (type === 'movie') {
      endpoint = `/player/${tmdbId}`;
    } else {
      endpoint = `/player/${tmdbId}?season=${season}&episode=${episode}`;
    }

    const { data } = await axios.get(`${API_BASE}${endpoint}`, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'cinestream-api.p.rapidapi.com'
      },
      timeout: 15000
    });

    console.log('API response:', JSON.stringify(data).slice(0, 300));

    const streams = [];

    if (data && data.url) {
      streams.push({
        name: 'CineStream | HD',
        title: '🎬 CineStream',
        url: data.url,
        behaviorHints: { notWebReady: false }
      });
    }

    if (data && data.sources && Array.isArray(data.sources)) {
      for (const src of data.sources) {
        const streamUrl = src.url || src.file || src.src;
        if (streamUrl) {
          streams.push({
            name: `CineStream | ${src.quality || src.label || 'HD'}`,
            title: '🎬 CineStream',
            url: streamUrl,
            behaviorHints: { notWebReady: false }
          });
        }
      }
    }

    if (data && data.link) {
      streams.push({
        name: 'CineStream | HD',
        title: '🎬 CineStream',
        url: data.link,
        behaviorHints: { notWebReady: false }
      });
    }

    console.log(`Found ${streams.length} streams`);
    return { streams };

  } catch (e) {
    console.log('Error:', e.response ? JSON.stringify(e.response.data) : e.message);
    return { streams: [] };
  }
});

module.exports = builder.getInterface();
