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

  let streams = [];

  if (type === 'movie') {
    streams = [
      {
        name: 'CineStream | 1080p',
        title: '🎬 Full HD Stream',
        url: `https://vidsrc.to/embed/movie/${imdbId}`,
        behaviorHints: { notWebReady: false }
      },
      {
        name: 'CineStream | HD',
        title: '🎬 HD Stream',
        url: `https://vidsrc.me/embed/movie?imdb=${imdbId}`,
        behaviorHints: { notWebReady: false }
      },
      {
        name: 'CineStream | Backup',
        title: '🎬 Backup Stream',
        url: `https://vidsrc.xyz/embed/movie?imdb=${imdbId}`,
        behaviorHints: { notWebReady: false }
      }
    ];
  } else if (type === 'series') {
    streams = [
      {
        name: 'CineStream | 1080p',
        title: `🎬 S${season}E${episode} Full HD`,
        url: `https://vidsrc.to/embed/tv/${imdbId}/${season}/${episode}`,
        behaviorHints: { notWebReady: false }
      },
      {
        name: 'CineStream | HD',
        title: `🎬 S${season}E${episode} HD`,
        url: `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`,
        behaviorHints: { notWebReady: false }
      },
      {
        name: 'CineStream | Backup',
        title: `🎬 S${season}E${episode} Backup`,
        url: `https://vidsrc.xyz/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`,
        behaviorHints: { notWebReady: false }
      }
    ];
  }

  return { streams };
});

module.exports = builder.getInterface();
