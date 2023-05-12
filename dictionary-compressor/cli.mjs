import fs from "fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { compress } from "./compressor.mjs";

yargs(hideBin(process.argv))
  .command({
    command: "$0 <dictDir> <outputFile>",
    describe:
      "Generates a compressed dictionary file from verbose dictionary files",
    builder: (yargs) => {
      yargs
        .positional("dictDir", {
          describe: "path to the folder containing verbose dictionary files",
          type: "string",
        })
        .positional("outputFile", {
          describe: "the file to output the compressed dictionary to",
          type: "string",
        });
    },
    handler: (argv) => {
      const { dictDir, outputFile } = argv;
      fs.writeFileSync(outputFile, compress(dictDir));
    },
  })
  .demandCommand(2)
  .strict()
  .help()
  .parse();
