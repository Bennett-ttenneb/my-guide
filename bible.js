// Embedded Bibles (from eBible.org, built by scripts/build-bibles.mjs).
// Shape: bible[book][chapter - 1][verse - 1] = text, '' where a translation has no such verse,
// [] for a chapter it does not have (e.g. the Old Testament of a New Testament-only translation).
// Order: English first, then other languages alphabetically by language name.
const PD = 'Public domain';
export const TRANSLATIONS = [
  { id: 'web', short: 'WEB', name: 'World English Bible', lang: 'en', copyright: PD },
  { id: 'kjv', short: 'KJV', name: 'King James Version', lang: 'en', copyright: PD },
  { id: 'asv', short: 'ASV', name: 'American Standard Version', lang: 'en', copyright: PD },
  { id: 'bbe', short: 'BBE', name: 'Bible in Basic English', lang: 'en', copyright: PD },
  { id: 'ylt', short: 'YLT', name: 'Young’s Literal Translation', lang: 'en', copyright: PD },
  { id: 'dby', short: 'DBY', name: 'Darby Translation', lang: 'en', copyright: PD },
  { id: 'bsb', short: 'BSB', name: 'Berean Standard Bible', lang: 'en', copyright: PD },
  { id: 'rv', short: 'RV', name: 'Revised Version (1885)', lang: 'en', copyright: PD },
  { id: 'wbs', short: 'WBS', name: 'Webster Bible (1833)', lang: 'en', copyright: PD },
  { id: 'wmb', short: 'WMB', name: 'World Messianic Bible', lang: 'en', copyright: PD },
  { id: 'gnv', short: 'GNV', name: 'Geneva Bible (1599)', lang: 'en', copyright: PD },
  // Psalms use the Vulgate numbering (Psalm 22 here is "The Lord ruleth me").
  { id: 'dra', short: 'DRA', name: 'Douay-Rheims (1899)', lang: 'en', copyright: PD },
  { id: 'nde', short: 'NDE', name: 'isiNdebele (Zimbabwe) – IBhayibhili Elingcwele LesiNdebele Elifinyelelekayo', lang: 'nd', copyright: 'CC BY-SA 4.0, © 2003, 2006, 2022 Biblica, Inc.' },
  { id: 'tsn', short: 'TSN', name: 'Setswana – Lefoko: La Botshelo Kgolagano e Ntsha (New Testament)', lang: 'tn', copyright: 'CC BY-SA 4.0, © 1993 Biblica, Inc.' },
];

// Literal paths so Metro bundles them; each file is only parsed the first time it is opened.
const LOAD = {
  web: () => require('./data/web.json'),
  kjv: () => require('./data/kjv.json'),
  asv: () => require('./data/asv.json'),
  bbe: () => require('./data/bbe.json'),
  ylt: () => require('./data/ylt.json'),
  dby: () => require('./data/dby.json'),
  bsb: () => require('./data/bsb.json'),
  rv: () => require('./data/rv.json'),
  wbs: () => require('./data/wbs.json'),
  wmb: () => require('./data/wmb.json'),
  gnv: () => require('./data/gnv.json'),
  dra: () => require('./data/dra.json'),
  nde: () => require('./data/nde.json'),
  tsn: () => require('./data/tsn.json'),
};

// Versions the user imported (see bibleStore.js), held in memory once loaded.
const imported = {};
export const registerBible = (id, books) => { imported[id] = books; };
export const unregisterBible = (id) => { delete imported[id]; };

export const getBible = (id) => imported[id] ?? (LOAD[id] ?? LOAD.web)();
