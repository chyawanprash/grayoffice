/**
 * Minimal store-only ZIP writer (no compression). Enough to bundle a handful
 * of PDFs for download from a Worker. ponytail: no deflate, no zip64 - fine for
 * a few dozen files; swap for a real lib if archives get large.
 */

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(buf: Uint8Array): number {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();

export function makeZip(files: { name: string; bytes: ArrayBuffer }[]): Uint8Array {
	const chunks: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;

	for (const f of files) {
		const nameBytes = enc.encode(f.name);
		const data = new Uint8Array(f.bytes);
		const crc = crc32(data);

		const local = new Uint8Array(30 + nameBytes.length);
		const lv = new DataView(local.buffer);
		lv.setUint32(0, 0x04034b50, true);
		lv.setUint16(4, 20, true); // version
		lv.setUint16(6, 0, true); // flags
		lv.setUint16(8, 0, true); // method: store
		lv.setUint16(10, 0, true); // time
		lv.setUint16(12, 0, true); // date
		lv.setUint32(14, crc, true);
		lv.setUint32(18, data.length, true);
		lv.setUint32(22, data.length, true);
		lv.setUint16(26, nameBytes.length, true);
		lv.setUint16(28, 0, true);
		local.set(nameBytes, 30);

		chunks.push(local, data);

		const cen = new Uint8Array(46 + nameBytes.length);
		const cv = new DataView(cen.buffer);
		cv.setUint32(0, 0x02014b50, true);
		cv.setUint16(4, 20, true);
		cv.setUint16(6, 20, true);
		cv.setUint16(8, 0, true);
		cv.setUint16(10, 0, true);
		cv.setUint16(12, 0, true);
		cv.setUint16(14, 0, true);
		cv.setUint32(16, crc, true);
		cv.setUint32(20, data.length, true);
		cv.setUint32(24, data.length, true);
		cv.setUint16(28, nameBytes.length, true);
		cv.setUint32(42, offset, true);
		cen.set(nameBytes, 46);
		central.push(cen);

		offset += local.length + data.length;
	}

	const centralSize = central.reduce((a, c) => a + c.length, 0);
	const eocd = new Uint8Array(22);
	const ev = new DataView(eocd.buffer);
	ev.setUint32(0, 0x06054b50, true);
	ev.setUint16(8, files.length, true);
	ev.setUint16(10, files.length, true);
	ev.setUint32(12, centralSize, true);
	ev.setUint32(16, offset, true);

	const total = offset + centralSize + 22;
	const out = new Uint8Array(total);
	let p = 0;
	for (const c of [...chunks, ...central, eocd]) {
		out.set(c, p);
		p += c.length;
	}
	return out;
}
