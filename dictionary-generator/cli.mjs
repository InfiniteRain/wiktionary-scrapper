import fs from "fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { generate } from "./generator.mjs";

yargs(hideBin(process.argv))
  .command({
    command: "$0 <sectionsFile> <outputDir> <low> <high>",
    describe: "Parses the section file and generates a verbose dictionary JSON",
    builder: (yargs) => {
      yargs
        .positional("sectionsFile", {
          describe: "sections file path",
          type: "string",
        })
        .positional("outputDir", {
          describe: "dictionary files output directory",
          type: "string",
        })
        .positional("low", {
          describe: "starting fetch index",
          type: "number",
        })
        .positional("high", {
          describe: "ending fetch index",
          type: "number",
        });
    },
    handler: (argv) => {
      const { sectionsFile, outputDir, low, high } = argv;
      generate(sectionsFile, low, high)
        .then(({ dictionary, failed }) => {
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
          }

          if (Object.keys(failed).length > 0) {
            fs.writeFileSync(
              `${outputDir}/${low}-${high}-failed.json`,
              JSON.stringify(failed, null, 2)
            );
          }

          fs.writeFileSync(
            `${outputDir}/${low}-${high}.json`,
            JSON.stringify(dictionary, null, 2)
          );

          console.log("DONE!");
        })
        .catch(console.error);
    },
  })
  .demandCommand(4)
  .strict()
  .help()
  .parse();
