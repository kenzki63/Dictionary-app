// scripts/build-wordnet-json.js
// Node 16+
// Usage: node scripts/build-wordnet-json.js
const fs = require("fs");
const path = require("path");
const wordnet = require("wordnet-db");

const OUT = path.resolve("public/dictionary.json");

function normalize(word) {
  return String(word).toLowerCase();
}

// wordnet-db provides synsets in wordnet.senses and index files in wordnet.index
// We'll iterate index files by POS

console.log("Building dictionary JSON from wordnet-db...");

const posMap = {
  noun: "nouns",
  verb: "verbs",
  adj: "adjectives",
  adv: "adverbs"
};

// index files are at node_modules/wordnet-db/dict/index.<pos>
const base = path.dirname(require.resolve("wordnet-db/package.json"));
const dictDir = path.join(base, "dict");

const posFiles = {
  noun: path.join(dictDir, "index.noun"),
  verb: path.join(dictDir, "index.verb"),
  adj: path.join(dictDir, "index.adj"),
  adv: path.join(dictDir, "index.adv")
};

const dictionary = {}; // top-level map: word -> { noun: [...], verb: [...], ... }

function parseIndexFile(pos, filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn("Missing index file for", pos, filePath);
    return;
  }
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  for (const line of lines) {
    if (!line || line.startsWith("  ") || line.startsWith("  ")) continue;
    // format: word pos synset_cnt ptr_symbols sense_cnt tags ...
    // fields are space separated; first field is the word (may contain spaces? usually not)
    const parts = line.split(/\s+/);
    const head = parts[0];
    if (!head) continue;
    const key = normalize(head);
    if (!dictionary[key]) dictionary[key] = {};
    if (!dictionary[key][pos]) dictionary[key][pos] = [];

    // the index file contains synset offsets (last fields) - easier: use wordnet-db's data files
    // We'll find all synsets for this word using wordnet-db's index mapping
  }
}

// Easier approach: use wordnet-db's synsets mapping
// wordnet-db/dict/data.* contains lines with synset info; but wordnet-db also includes index files we can parse to find offsets
// Instead we will use the provided "index" files to map words to offsets, then read the offsets from data.<pos>

function loadIndexOffsets(pos) {
  const idxPath = posFiles[pos];
  if (!fs.existsSync(idxPath)) return {};
  const lines = fs.readFileSync(idxPath, "utf8").split("\n");
  const map = {};
  for (const line of lines) {
    if (!line) continue;
    const parts = line.split(/\s+/);
    const head = parts[0];
    // offsets start at 4th or later positions -- but index format: word pos synset_cnt ptr_symbols sense_cnt tags...
    // Offsets are not included in index files; better: use data.* and search
    // Simpler: read the data.<pos> file and gather synsets by words
  }
  return map;
}

function parseDataFile(pos) {
  const dataPath = path.join(dictDir, `data.${pos === "adj" ? "adj" : pos}`);
  if (!fs.existsSync(dataPath)) return;
  const lines = fs.readFileSync(dataPath, "utf8").split("\n");
  for (const line of lines) {
    if (!line || line.startsWith("  ")) continue;
    // format: offset  lex_filenum  ss_type  w_cnt  word lex_id [word lex_id...] p_cnt ptr... | gloss
    const [offset, lex_filenum, ss_type, w_cnt_hex, ...rest] = line.split(/\s+/);
    // w_cnt is hex-coded eg '02' or '03'
    const wcnt = parseInt(w_cnt_hex, 16);
    if (isNaN(wcnt) || wcnt <= 0) continue;
    // words come next: wcnt * 2 entries (word, lex_id)
    const words = [];
    let idx = 4; // starting index for word tokens in the split array
    for (let i = 0; i < wcnt; i++) {
      const w = rest[(i * 2)];
      if (w) words.push(w.replace(/_/g, " "));
    }
    // gloss is after a '|' token
    const pipeIndex = line.indexOf(" | ");
    const gloss = pipeIndex >= 0 ? line.slice(pipeIndex + 3).trim() : "";
    // use ss_type (n, v, a, r) -> pos
    let posKey = null;
    if (ss_type === "n") posKey = "noun";
    else if (ss_type === "v") posKey = "verb";
    else if (ss_type === "a" || ss_type === "s") posKey = "adj";
    else if (ss_type === "r") posKey = "adv";
    if (!posKey) continue;
    // For each word in words, add the gloss as a definition and other words as synonyms (excluding the word itself)
    for (const w of words) {
      const key = normalize(w);
      if (!dictionary[key]) dictionary[key] = {};
      if (!dictionary[key][posKey]) dictionary[key][posKey] = [];
      const synonyms = words.filter(x => x.toLowerCase() !== w.toLowerCase());
      // push block
      dictionary[key][posKey].push({
        definition: gloss || "",
        synonyms: synonyms
      });
    }
  }
}

["noun", "verb", "adj", "adv"].forEach((p) => parseDataFile(p));

console.log("Built dictionary entries:", Object.keys(dictionary).length);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(dictionary, null, 2), "utf8");
console.log("Wrote", OUT);
