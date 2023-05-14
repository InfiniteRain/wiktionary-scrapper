import fs from "fs";
import { decode } from "html-entities";
import { JSDOM } from "jsdom";
import { Task, startAsyncExecutionQueue } from "./async-queue.mjs";

const partsOfSpeech = [
  "Noun",
  "Pronoun",
  "Interjection",
  "Verb",
  "Adverb",
  "Contraction",
  "Article",
  "Conjunction",
  "Numeral",
  "Adjective",
  "Preposition",
  "Proper noun",
  "Letter",
  "Prefix",
  "Idiom",
  "Phrase",
  "Determiner",
  "Participle",
  "Suffix",
  "Prepositional phrase",
  "Interfix",
  "Diacritical mark",
  "Proverb",
  "Particle",
  "Circumposition",
  "Circumfix",
  "Abbreviation",
];
const definitionPosRegex = new RegExp(
  `^====?(${partsOfSpeech.join("|")})=?===`
);
const definitionPosReplaceRegex = new RegExp(
  `====?(${partsOfSpeech.join("|")})=?===`,
  "g"
);
const wordExtractRegex = /^([^:]+):/;

const parseSections = (sourceFile) => {
  const fileContent = fs.readFileSync(sourceFile, { encoding: "utf8" });
  const sections = fileContent.split(">>>WORD ");
  const parsedSections = [];

  for (const section of sections) {
    if (section.trim() === "") {
      continue;
    }

    const word = section.match(wordExtractRegex)[1];
    const lines = section.split("\n");
    const definitions = [];
    let isDefinition = false;
    let currentDefinition = "";

    for (const line of lines) {
      if (definitionPosRegex.test(line)) {
        isDefinition = true;
      } else if (isDefinition && /^==/.test(line)) {
        definitions.push(currentDefinition);
        isDefinition = false;
        currentDefinition = "";
      }

      if (isDefinition) {
        currentDefinition += `${line}\n`;
      }
    }

    if (currentDefinition.trim() !== "") {
      definitions.push(currentDefinition);
    }

    parsedSections.push({
      word,
      content: `${definitions
        .join("\n")
        .replaceAll(definitionPosReplaceRegex, "|DELIM|$1:") // add delimiters on POS headings
        .replace(/{{wikipedia.*?}}/g, "") // remove wikipedia references
        .replace(/{{slim-wikipedia.*?}}/g, "") // remove wikipedia references
        .replace(/{{wp\|.*?}}/g, "") // remove wikipedia references
        .replace(/{{cardinalbox.*?}}/g, "")}`, // remove the cardinal box
    });
  }

  return parsedSections;
};

const parseWikiText = async (title, wikiText) => {
  const encodedWikiText = encodeURIComponent(wikiText);
  const url = `https://en.wiktionary.org/w/api.php?action=parse&text=${encodedWikiText}&prop=text&title=${title}&formatversion=2&format=json`;
  let responseBody = "";
  let responseJson;
  let errorCount = 0;

  while (true) {
    try {
      const response = await fetch(url);
      responseBody = await response.text();
      responseJson = JSON.parse(responseBody);
      break;
    } catch (e) {
      if (responseBody.includes("414 Request-URI Too Long")) {
        throw new Error("Request URI is too long");
      }
      console.log("Caught error:", e, responseBody);
      console.log("Retrying...");
      errorCount++;

      if (errorCount >= 10) {
        throw new Error("Too many retries");
      }
    }
  }

  return responseJson.parse.text;
};

const formatSegmentPart = (text) => {
  // decoding twice as some examples are doubly encoded
  return decode(
    decode(text)
      .replace(/<<([^>]*)>>/g, "$1") // remove << >> around some terms
      .replace(/<ref>[^<]*<\/ref>/g, "") // remove all ref tags alongside their contents
      .replace(/<\/?[^>]+(>|$)/g, "") // remove all other html tags, but not their contents
  )
    .trim()
    .replaceAll(/\s+/g, " ");
};

const parsedSegmentToDefinitionEntry = ([_, partOfSpeech, segment]) => {
  const entry = { partOfSpeech };

  // Strip all HTML comments
  segment = segment.replace(/(?:&lt;|<)!\-\-.*?\-\-(?:&gt;|>)/g, "");

  const indexOfOl = segment.indexOf("<ol>");

  if (indexOfOl === -1) {
    entry.title = formatSegmentPart(segment);
    return entry;
  }

  entry.title = formatSegmentPart(segment.substring(0, indexOfOl));
  entry.definitions = [];

  const definitionSection = segment.substring(indexOfOl);
  const dom = new JSDOM(definitionSection);
  const elements = dom.window.document.querySelectorAll("body>ol>li");

  for (const element of elements) {
    const definition = {};
    const definitionParts = [];

    for (const child of element.childNodes) {
      if (
        child.nodeType === 1 &&
        (child.tagName === "DL" ||
          child.tagName === "OL" ||
          child.tagName === "UL")
      ) {
        break;
      }
      definitionParts.push(
        child.nodeType === 1 ? child.innerHTML : child.textContent
      );
    }

    definition.text = formatSegmentPart(definitionParts.join(""));

    let currentExample = "";
    for (const exampleElement of element.querySelectorAll(
      ".h-usage-example .e-example, .h-usage-example .e-translation"
    )) {
      const isExample = exampleElement.outerHTML.includes("e-example");
      const isTranslation = exampleElement.outerHTML.includes("e-translation");

      if (isExample) {
        if (currentExample !== "") {
          definition.examples = definition.examples ?? [];
          definition.examples.push([currentExample]);
        }

        currentExample = formatSegmentPart(exampleElement.innerHTML);
      }

      if (isTranslation) {
        if (currentExample === "") {
          continue;
        }

        definition.examples = definition.examples ?? [];
        definition.examples.push([
          currentExample,
          formatSegmentPart(exampleElement.innerHTML),
        ]);

        currentExample = "";
      }
    }

    if (definition.text !== "") {
      entry.definitions.push(definition);
    }
  }

  return entry;
};

const generate = async (sourceFile, low, high, concurrentRequests) => {
  const parsedSections = parseSections(sourceFile);
  const tasks = [];

  for (const [key, { word, content }] of parsedSections
    .slice(low, high)
    .entries()) {
    // ignore sections without an acceptable POS section
    if (content.trim().length === 0) {
      continue;
    }

    tasks.push(
      new Task(async (resolve, reject) => {
        console.log(`Parsing ${low + key + 1}/${high}...`);

        let parsedText;

        try {
          parsedText = await parseWikiText(word, content);
        } catch {
          reject({ type: "error", word, content });
          return;
        }

        const parsedSegments = parsedText
          .split("|DELIM|")
          .filter((piece) => piece !== `<div class="mw-parser-output"><p>`)
          .map((piece) => {
            const pos = piece.match(wordExtractRegex)[1];
            return [word, pos, piece.replace(new RegExp(`^${pos}:`), "")];
          });
        const entries = [];

        for (const segment of parsedSegments) {
          entries.push(parsedSegmentToDefinitionEntry(segment));
        }

        resolve({
          type: "success",
          word,
          entries,
        });
      })
    );
  }

  const result = await startAsyncExecutionQueue(concurrentRequests, tasks);
  const dictionary = {};
  const failed = {};

  for (const item of result) {
    if (item.type === "error") {
      failed[item.word] = item.content;
      continue;
    }

    dictionary[item.word] = item.entries;
  }

  return {
    dictionary,
    failed,
  };
};

export { generate };
