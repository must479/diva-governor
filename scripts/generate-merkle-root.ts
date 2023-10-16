import { Command } from "commander";
import fs from "fs";
import { parseBalanceMap } from "../src/parse-balance-map";

const program = new Command();

program
  .version("0.0.0")
  .requiredOption(
    "-i, --input <path>",
    "input JSON file location containing a map of account addresses to string balances"
  )
  .requiredOption(
    "-o, --output <path>",
    "output JSON file location containing a the merkle root and the merkle tree"
  )
  .parse(process.argv);

const options = program.opts();

const json = JSON.parse(fs.readFileSync(options.input, { encoding: "utf8" }));

if (typeof json !== "object") throw new Error("Invalid JSON");

fs.writeFileSync(options.output, JSON.stringify(parseBalanceMap(json)));
