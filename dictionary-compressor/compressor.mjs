import fs from "fs";

const posMap = {
  Noun: "n",
  Pronoun: "p",
  Interjection: "i",
  Verb: "v",
  Adverb: "av",
  Contraction: "ct",
  Article: "a",
  Conjunction: "c",
  Numeral: "nm",
  Adjective: "ad",
  Preposition: "pr",
  "Proper noun": "pn",
  Letter: "l",
  Prefix: "pf",
  Idiom: "id",
  Phrase: "ph",
  Determiner: "dt",
  Participle: "pc",
  Suffix: "sf",
  "Prepositional phrase": "pp",
  Interfix: "if",
  "Diacritical mark": "dm",
  Proverb: "pv",
  Particle: "pt",
  Circumposition: "cp",
  Circumfix: "cf",
  Abbreviation: "ab",
};

const compress = (dictDir) => {
  const files = fs
    .readdirSync(dictDir)
    .filter((file) => !file.includes("failed"));

  let dict = {};
  for (const file of files) {
    const json = JSON.parse(
      fs.readFileSync(`${dictDir}/${file}`, { encoding: "utf8" })
    );

    dict = { ...dict, ...json };
  }

  const toDelete = [];

  for (const [key, value] of Object.entries(dict)) {
    for (const [entryKey, entryValue] of Object.entries(value)) {
      if (!entryValue.definitions || entryValue.definitions.length === 0) {
        toDelete.push([key, entryKey]);
      }
    }
  }

  for (const [key, entryKey] of toDelete) {
    delete dict[key][entryKey];

    if (dict[key].length === 0) {
      delete dict[key];
    }
  }

  const finalDict = Object.fromEntries(
    [...Object.entries(dict)].map(([key, value]) => [
      key,
      value.map((entry) => [
        entry.title,
        posMap[entry.partOfSpeech],
        entry.definitions.map((definition) => [
          definition.text,
          ...(definition.examples ? [definition.examples] : []),
        ]),
      ]),
    ])
  );

  return JSON.stringify(finalDict);
};

export { compress };
