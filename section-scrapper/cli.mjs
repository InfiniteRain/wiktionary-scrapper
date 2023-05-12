import fs from "fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { scrapDump } from "./scrapper.mjs";

yargs(hideBin(process.argv))
  .command({
    command: "$0 <wikidumpFile> <outputFile>",
    describe: "Parses the section file and generates a verbose dictionary JSON",
    builder: (yargs) => {
      yargs
        .positional("wikidumpFile", {
          describe: "file path to the wikidump",
          type: "string",
        })
        .positional("outputFile", {
          describe: "the output sections file",
          type: "string",
        });
    },
    handler: (argv) => {
      const { wikidumpFile, outputFile } = argv;
      scrapDump(wikidumpFile)
        .then((sectionsDump) => {
          fs.writeFileSync(outputFile, sectionsDump);
        })
        .catch(console.error);
    },
  })
  .demandCommand(2)
  .strict()
  .help()
  .parse();
