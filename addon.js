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
  'Accept': 'application/json',
};

// Get title from IMDb ID using Cinemeta
async function fetchMeta(imdbId, type) {
  try {
    const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`;
    const { data } = await axios.get(url, { timeout: 8000 });
    return {
      title: data.meta.name,
      year: data.meta.year || ''
    };
  } catch (e) {
    console.log('Meta fetch error:', e.message);
    return null;
  }
}

// Source 1: YTS API (works perfectly from servers - movies only)
async function getYTSStreams(title, year) {
  const streams = [];
  try {
    const searchUrl = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(title)}&limit=5`;
    const { data } = await axios.get(searchUrl, { headers: HEADERS, timeout: 10000 });

    if (!data.data || !data.data.movies) return streams;

    const movies = data.data.movies;
    const match = movies.find(m =>
      m.title.toLowerCase().includes(title.toLowerCase().split(' ')[0]) ||
      title.toLowerCase().includes(m.title.toLowerCase().split(' ')[0])
    );

    if (!match) return streams;

    for (const torrent of match.torrents) {
      streams.push({
        name: `CineStream | YTS\n${torrent.quality} ${torrent.type}`,
        title: `⚡ ${torrent.size} | 👥 ${torrent.seeds} seeds`,
        infoHash: torrent.hash.toLowerCase(),
        sources: [`tracker:udp://open.demonii.com:1337/announce`,
                  `tracker:udp://tracker.openbittorrent.com:80`,
                  `tracker:udp://tracker.coppersurfer.tk:6969`],
        behaviorHints: { bingeGroup: 'cinestream' }
      });
    }
  } catch (e) {
    console.log('YTS error:', e.message);
  }
  return streams;
}

// Source 2: EZTV API (series only)
async function getEZTVStreams(imdbId, season, episode) {
  const streams = [];
  try {
    const imdbNumber = imdbId.replace('tt', '');
    const url = `https://eztv.re/api/get-torrents?imdb_id=${imdbNumber}&limit=10`;
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });

    if (!data.torrents) return streams;

    const filtered = data.torrents.filter(t => {
      if (!season || !episode) return true;
      const s = String(season).padStart(2, '0');
      const e = String(episode).padStart(2, '0');
      return t.title.includes(`S${s}E${e}`) || t.title.includes(`s${s}e${e}`);
    });

    for (const torrent of filtered.slice(0, 5)) {
      const hash = torrent.hash ? torrent.hash.toLowerCase() : null;
      if (!hash) continue;
      streams.push({
        name: `CineStream | EZTV`,
        title: `${torrent.title}\n💾 ${torrent.size_bytes ? Math.round(torrent.size_bytes / 1073741824 * 10) / 10 + ' GB' : 'Unknown size'} | 👥 ${torrent.seeds || 0} seeds`,
        infoHash: hash,
        sources: [`tracker:udp://open.demonii.com:1337/announce`,
                  `tracker:udp://tracker.openbittorrent.com:80`],
        behaviorHints: { bingeGroup: 'cinestream' }
      });
    }
  } catch (e) {
    console.log('EZTV error:', e.message);
  }
  return streams;
}

// Source 3: Public torrent search via Knaben API
async function getKnabenStreams(title, type, season, episode) {
  const streams = [];
  try {
    let query = title;
    if (type === 'series' && season && episode) {
      const s = String(season).padStart(2, '0');
      const e = String(episode).padStart(2, '0');
      query = `${title} S${s}E${e}`;
    }

    const url = `https://knaben.eu/api/v1/search?search=${encodeURIComponent(query)}&categories=200,201,202&orderBy=seeders&limit=5`;
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });

    if (!data || !data.hits) return streams;

    for (const item of data.hits.slice(0, 5)) {
      if (!item.infoHash) continue;
      streams.push({
        name: `CineStream | Knaben`,
        title: `${item.title}\n💾 ${item.bytes ? Math.round(item.bytes / 1073741824 * 10) / 10 + ' GB' : ''} | 👥 ${item.seeders || 0} seeds`,
        infoHash: item.infoHash.toLowerCase(),
        sources: [`tracker:udp://open.demonii.com:1337/announce`,
                  `tracker:udp://tracker.openbittorrent.com:80`,
                  `tracker:udp://tracker.coppersurfer.tk:6969`],
        behaviorHints: { bingeGroup: 'cinestream' }
      });
    }
  } catch (e) {
    console.log('Knaben error:', e.message);
  }
  return streams;
}

// Main stream handler
builder.defineStreamHandler(async ({ type, id }) => {
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1] || null;
  const episode = parts[2] || null;

  const meta = await fetchMeta(imdbId, type);
  if (!meta) return { streams: [] };

  console.log(`Searching: ${meta.title} (${type})`);

  let streams = [];

  if (type === 'movie') {
    const [yts, knaben] = await Promise.allSettled([
      getYTSStreams(meta.title, meta.year),
      getKnabenStreams(meta.title, type, null, null)
    ]);
    streams = [
      ...(yts.status === 'fulfilled' ? yts.value : []),
      ...(knaben.status === 'fulfilled' ? knaben.value : [])
    ];
  } else {
    const [eztv, knaben] = await Promise.allSettled([
      getEZTVStreams(imdbId, season, episode),
      getKnabenStreams(meta.title, type, season, episode)
    ]);
    streams = [
      ...(eztv.status === 'fulfilled' ? eztv.value : []),
      ...(knaben.status === 'fulfilled' ? knaben.value : [])
    ];
  }

  console.log(`Found ${streams.length} streams for ${meta.title}`);
  return { streams };
});

module.exports = builder.getInterface();
