// One-off generator for E2E fixture files - run manually, not part of the
// test suite. Produces a small valid PNG and a minimal valid PDF so E2E
// attachment tests exercise real, backend-accepted file bytes.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function chunk(tag, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(tag), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlibCrc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

// Minimal CRC32 (no external deps).
function zlibCrc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function makePng(outPath, width = 4, height = 4) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type RGB
  const ihdr = chunk("IHDR", ihdrData);

  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      row[1 + x * 3] = (x * 40) % 255;
      row[2 + x * 3] = (y * 40) % 255;
      row[3 + x * 3] = 120;
    }
    rows.push(row);
  }
  const idat = chunk("IDAT", zlib.deflateSync(Buffer.concat(rows)));
  const iend = chunk("IEND", Buffer.alloc(0));

  fs.writeFileSync(outPath, Buffer.concat([sig, ihdr, idat, iend]));
}

function makePdf(outPath) {
  const content =
    "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "xref\n0 4\n0000000000 65535 f \n" +
    "trailer<</Size 4/Root 1 0 R>>\n" +
    "%%EOF";
  fs.writeFileSync(outPath, content, "utf8");
}

const dir = __dirname;
makePng(path.join(dir, "sample.png"));
makePdf(path.join(dir, "sample.pdf"));
console.log("Wrote sample.png and sample.pdf to", dir);
