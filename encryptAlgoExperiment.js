const fs = require("fs");
const csv = require("csv-parser");
const CryptoJS = require("crypto-js");
const { performance } = require("perf_hooks");
const { createObjectCsvWriter } = require("csv-writer");

// Function to load CSV records
function loadRecordsFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => records.push(data))
      .on("end", () => resolve(records))
      .on("error", (error) => reject(error));
  });
}

// Function to encrypt a single record
function encryptRecord(record, key, algorithm = "AES") {
  let encrypted;
  switch (algorithm) {
    case "AES":
      encrypted = CryptoJS.AES.encrypt(JSON.stringify(record), key).toString();
      break;
    case "DES":
      encrypted = CryptoJS.DES.encrypt(JSON.stringify(record), key).toString();
      break;
    case "3DES":
      encrypted = CryptoJS.TripleDES.encrypt(
        JSON.stringify(record),
        key
      ).toString();
      break;
    case "RC4":
      encrypted = CryptoJS.RC4.encrypt(JSON.stringify(record), key).toString();
      break;
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
  return encrypted;
}

// Measure encryption time
function measureEncryption(records, key, algorithm = "AES") {
  const start = performance.now();

  const encryptedRecords = records.map((record) =>
    encryptRecord(record, key, algorithm)
  );

  const end = performance.now();
  return {
    algorithm,
    keyLength: getKeyLengthInBits(key, algorithm),
    time: end - start,
    averageTimePerRecord: (end - start) / records.length,
    encryptedRecords,
  };
}

function getKeyLengthInBits(key, algorithm) {
  switch (algorithm.toUpperCase()) {
    case "DES":
      return 56;
    case "3DES":
      return 168;
    case "AES":
      return Math.min(key.length * 8, 256);
    case "RC4":
      return key.length * 8;
    default:
      return key.length * 8;
  }
}

function formatResultForCsv(result, batchSize) {
  return {
    algorithm: result.algorithm,
    keyLength: result.keyLength,
    records: batchSize,
    encryptionTime: parseFloat((result.time / 1000).toFixed(2)),
  };
}

async function testEncryption(filePath) {
  try {
    const records = await loadRecordsFromCSV(filePath);

    const testSizes = [
      3000, 6000, 9000, 12000, 15000, 18000, 21000, 25000, 30000,
    ];
    const algorithms = ["AES", "DES", "3DES", "RC4"];
    const keys = {
      AES: [
        "1234567890123456", // 128-bit
        "12345678901234567890123456789012",
      ],
      DES: ["12345678"],
      "3DES": ["123456789012345678901234"],
      RC4: [
        "1234567890123456", // 128-bit
        "12345678901234567890123456789012",
      ],
    };

    const allResults = [];

    console.log("Encryption Performance Results:");
    console.log("================================");

    for (const size of testSizes) {
      const subset = records.slice(0, size);
      console.log(`\nTesting ${size} records:`);

      for (const algo of algorithms) {
        console.log(`\nAlgorithm: ${algo}`);

        for (const key of keys[algo]) {
          const result = measureEncryption(subset, key, algo);
          console.log(
            `Key Size: ${result.keyLength} bits, Records: ${size}, Time: ${(
              result.time / 1000
            ).toFixed(2)} s`
          );
          allResults.push(formatResultForCsv(result, size));
        }
      }
      console.log("==============================================");
    }

    const csvWriter = createObjectCsvWriter({
      path: "encryption_benchmark_results.csv",
      header: [
        { id: "algorithm", title: "Algorithm" },
        { id: "keyLength", title: "Key Length (bits)" },
        { id: "records", title: "Records" },
        { id: "encryptionTime", title: "Encryption Time (s)" },
      ],
    });

    await csvWriter.writeRecords(allResults);
    console.log(
      "\nResults have been exported to encryption_benchmark_results.csv"
    );
  } catch (error) {
    console.error("Test execution failed:", error);
    throw error;
  }
}

// Run the test
testEncryption("birth_records.csv").catch((error) =>
  console.error("Error:", error)
);
