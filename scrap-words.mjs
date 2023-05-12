import fs from "fs";
import readline from "readline";

const fileStream = fs.createReadStream("./wikidump");
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity,
});

let isPage = false;
let isSection = false;
let currentSection = [];
let currentWord = [];
const sections = [];

for await (const line of rl) {
  if (line.includes("<page>")) {
    isPage = true;
    continue;
  }

  if (isPage) {
    if (line.includes("==Dutch==")) {
      isSection = true;
    } else if (/(?:^|[^=])==[^=]+==(?:$|[^=])/.test(line)) {
      isSection = false;
    }

    if (isSection) {
      currentSection.push(line);
    }

    if (line.includes("<title>")) {
      currentWord = line.match(/<title>(.*?)<\/title>/s)[1];
    }
  }

  if (line.includes("</page>")) {
    if (isSection) {
      sections.push(`>>>WORD ${currentWord}:\n${currentSection.join("\n")}\n`);
    }

    isPage = false;
    isSection = false;
    currentSection = [];
    currentWord = "";
  }
}

fs.writeFileSync("./sections.txt", sections.join("\n"));
