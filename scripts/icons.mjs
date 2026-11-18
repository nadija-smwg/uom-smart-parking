import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const glyph = [
  "11110","10001","10001","11110","10000","10000","10000",
];
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let i=0;i<8;i++) crc=(crc>>>1) ^ ((crc&1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
function chunk(type,data) {
  const header=Buffer.alloc(8);
  header.writeUInt32BE(data.length);
  header.write(type,4);
  const tail=Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([header.subarray(4),data])));
  return Buffer.concat([header,data,tail]);
}
function icon(size) {
  const pixels = Buffer.alloc((size*3+1)*size);
  const scale = Math.floor(size/14);
  const x0 = Math.floor((size-5*scale)/2);
  const y0 = Math.floor((size-7*scale)/2);
  for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const row = Math.floor((y-y0)/scale);
    const col = Math.floor((x-x0)/scale);
    const filled = glyph[row]?.[col] === "1";
    const offset = y*(size*3+1)+1+x*3;
    const color = filled ? [248,245,233] : [23,59,104];
    pixels.set(color,offset);
  }
  const info = Buffer.alloc(13);
  info.writeUInt32BE(size); info.writeUInt32BE(size,4); info[8]=8; info[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk("IHDR",info),chunk("IDAT",deflateSync(pixels)),chunk("IEND",Buffer.alloc(0))]);
}
await mkdir("public",{recursive:true});
for(const size of [192,512]) await writeFile("public/icon-"+size+".png",icon(size));
