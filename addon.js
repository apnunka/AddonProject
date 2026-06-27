const { addonBuilder } = require('stremio-addon-sdk');

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

builder.defineStreamHandler(async ({ type, id }) => {
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1] || '1';
  const episode = parts[2] || '1';

  const streams = [];

  if (type === 'movie') {
    streams.push({
      name: 'CineStream | Watch',
      title: '🎬 Open in Browser',
      externalUrl: `https://multiembed.mov/?video_id=${imdbId}`
    });
    streams.push({
      name: 'CineStream | Watch 2',
      title: '🎬 Open in Browser',
      externalUrl: `https://www.2embed.cc/embed/${imdbId}`
    });
  } else {
    streams.push({
      name: 'CineStream | Watch',
      title: `🎬 S${season}E${episode} Open in Browser`,
      externalUrl: `https://multiembed.mov/?video_id=${imdbId}&s=${season}&e=${episode}`
    });
    streams.push({
      name: 'CineStream | Watch 2',
      title: `🎬 S${season}E${episode} Open in Browser`,
      externalUrl: `https://www.2embed.cc/embedtv/${imdbId}&s=${season}&e=${episode}`
    });
  }

  return { streams };
});

module.exports = builder.getInterface();
