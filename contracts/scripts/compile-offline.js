#!/usr/bin/env node
/**
 * Offline compilation script for AutoTreasury AI contracts.
 *
 * Uses the locally-installed `solc` npm package to compile contracts and
 * generate Hardhat-compatible artifacts + build-info files.  This avoids the
 * need to download the native solc binary from soliditylang.org, making it
 * possible to compile in air-gapped environments.
 *
 * Usage:
 *   node scripts/compile-offline.js
 */

// @ts-check
"use strict";

const solc = require("solc");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CORE_DIR = path.join(ROOT, "core");
const ARTIFACTS_DIR = path.join(ROOT, "artifacts");

/** @param {string} importPath */
function resolveImport(importPath) {
  const candidates = [
    importPath.startsWith("@openzeppelin/")
      ? path.join(ROOT, "node_modules", importPath)
      : null,
    path.join(CORE_DIR, importPath),
    path.join(ROOT, importPath),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return { contents: fs.readFileSync(/** @type {string} */ (candidate), "utf8") };
    } catch {
      // try next candidate
    }
  }
  return { error: `File not found: ${importPath}` };
}

/** @type {Record<string, { content: string }>} */
const sources = {};

// Discover all .sol files in ./core
for (const file of fs.readdirSync(CORE_DIR)) {
  if (!file.endsWith(".sol")) continue;
  const key = `core/${file}`;
  sources[key] = { content: fs.readFileSync(path.join(CORE_DIR, file), "utf8") };
}

/** @type {import("solc").CompilerInput} */
const compilationInput = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": {
        "": ["ast"],
        "*": [
          "abi",
          "evm.bytecode",
          "evm.deployedBytecode",
          "evm.methodIdentifiers",
          "metadata",
          "userdoc",
          "devdoc",
          "storageLayout",
        ],
      },
    },
  },
};

console.log("Compiling contracts with solc", solc.version(), "...");

/** @type {import("solc").CompilerOutput} */
const output = JSON.parse(
  solc.compile(JSON.stringify(compilationInput), { import: resolveImport })
);

// Collect all source files referenced by the compiler (including imports).
/** @type {Record<string, { content: string }>} */
const allSources = { ...sources };
for (const srcKey of Object.keys(output.sources || {})) {
  if (!allSources[srcKey]) {
    const resolved = resolveImport(srcKey);
    if ("contents" in resolved) {
      allSources[srcKey] = { content: resolved.contents };
    }
  }
}
compilationInput.sources = allSources;

const errors = (output.errors || []).filter((e) => e.severity === "error");
if (errors.length > 0) {
  console.error("Compilation errors:");
  for (const err of errors) console.error(" ", err.message);
  process.exit(1);
}

const warnings = (output.errors || []).filter((e) => e.severity === "warning");
if (warnings.length > 0) {
  console.warn(`${warnings.length} warning(s) (ignored).`);
}

// Write build-info JSON (required by Hardhat EDR for contract verification).
const buildInfoDir = path.join(ARTIFACTS_DIR, "build-info");
fs.mkdirSync(buildInfoDir, { recursive: true });

const buildInfo = {
  _format: "hh-sol-build-info-1",
  id: "offline-build",
  solcVersion: "0.8.26",
  solcLongVersion: "0.8.26+commit.8a97fa7a",
  input: compilationInput,
  output,
};

fs.writeFileSync(path.join(buildInfoDir, "offline-build.json"), JSON.stringify(buildInfo));
console.log("  \u2713 build-info/offline-build.json");

// Write per-contract artifact JSON files.
for (const [srcName, contracts] of Object.entries(output.contracts || {})) {
  for (const [contractName, contract] of Object.entries(contracts)) {
    const contractDir = path.join(ARTIFACTS_DIR, srcName);
    fs.mkdirSync(contractDir, { recursive: true });

    const artifact = {
      _format: "hh-sol-artifact-1",
      contractName,
      sourceName: srcName,
      abi: contract.abi,
      bytecode: "0x" + contract.evm.bytecode.object,
      deployedBytecode: "0x" + contract.evm.deployedBytecode.object,
      linkReferences: {},
      deployedLinkReferences: {},
    };

    fs.writeFileSync(
      path.join(contractDir, `${contractName}.json`),
      JSON.stringify(artifact, null, 2)
    );
    fs.writeFileSync(
      path.join(contractDir, `${contractName}.dbg.json`),
      JSON.stringify({
        _format: "hh-sol-dbg-1",
        buildInfo: "../../build-info/offline-build.json",
      }, null, 2)
    );
    console.log(`  \u2713 ${srcName}/${contractName}`);
  }
}

console.log("Compilation complete.");
