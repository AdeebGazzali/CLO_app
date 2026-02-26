const fs = require('fs');
const zlib = require('zlib');

function createPNG(size) {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    const ihd = Buffer.alloc(13);
    ihd.writeUInt32BE(size, 0);
    ihd.writeUInt32BE(size, 4);
    ihd[8] = 8;
    ihd[9] = 2;
    ihd[10] = 0;
    ihd[11] = 0;
    ihd[12] = 0;

    const raw = Buffer.alloc((size * 3 + 1) * size);
    for (let y = 0; y < size; y++) {
        const o = y * (size * 3 + 1);
        raw[o] = 0;
        for (let x = 0; x < size; x++) {
            const p = o + 1 + x * 3;
            const cx = size / 2;
            const cy = size / 2;
            const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
            const r = size * 0.3;
            if (d < r) {
                raw[p] = 99;
                raw[p + 1] = 102;
                raw[p + 2] = 241;
            } else {
                raw[p] = 10;
                raw[p + 1] = 10;
                raw[p + 2] = 10;
            }
        }
    }

    const compressed = zlib.deflateSync(raw);

    function chunk(type, data) {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length, 0);
        const tb = Buffer.from(type, 'ascii');
        const cd = Buffer.concat([tb, data]);
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < cd.length; i++) {
            crc ^= cd[i];
            for (let j = 0; j < 8; j++) {
                crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
            }
        }
        crc = (crc ^ 0xFFFFFFFF) >>> 0;
        const cb = Buffer.alloc(4);
        cb.writeUInt32BE(crc, 0);
        return Buffer.concat([len, tb, data, cb]);
    }

    return Buffer.concat([sig, chunk('IHDR', ihd), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

fs.writeFileSync('public/icon-192.png', createPNG(192));
console.log('Created icon-192.png');
fs.writeFileSync('public/icon-512.png', createPNG(512));
console.log('Created icon-512.png');
