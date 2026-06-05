// Minimal ZIP writer (STORE method, no compression) in pure browser JS.
// Enough to assemble a valid .docx (which is just a ZIP of XML parts).

function crc32Table(): Uint32Array {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
}
const TABLE = crc32Table()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

const enc = new TextEncoder()

export function strToBytes(s: string): Uint8Array {
  return enc.encode(s)
}

function writeUint32LE(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}
function writeUint16LE(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value & 0xffff, true)
}

export function createZip(entries: ZipEntry[]): Blob {
  const localParts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    // Local file header (30 bytes + name)
    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    writeUint32LE(lv, 0, 0x04034b50)
    writeUint16LE(lv, 4, 20) // version needed
    writeUint16LE(lv, 6, 0) // flags
    writeUint16LE(lv, 8, 0) // compression: store
    writeUint16LE(lv, 10, 0) // mod time
    writeUint16LE(lv, 12, 0) // mod date
    writeUint32LE(lv, 14, crc)
    writeUint32LE(lv, 18, size)
    writeUint32LE(lv, 22, size)
    writeUint16LE(lv, 26, nameBytes.length)
    writeUint16LE(lv, 28, 0)
    local.set(nameBytes, 30)

    localParts.push(local, entry.data)

    // Central directory record (46 bytes + name)
    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    writeUint32LE(cv, 0, 0x02014b50)
    writeUint16LE(cv, 4, 20)
    writeUint16LE(cv, 6, 20)
    writeUint16LE(cv, 8, 0)
    writeUint16LE(cv, 10, 0)
    writeUint16LE(cv, 12, 0)
    writeUint16LE(cv, 14, 0)
    writeUint32LE(cv, 16, crc)
    writeUint32LE(cv, 20, size)
    writeUint32LE(cv, 24, size)
    writeUint16LE(cv, 28, nameBytes.length)
    writeUint16LE(cv, 30, 0)
    writeUint16LE(cv, 32, 0)
    writeUint16LE(cv, 34, 0)
    writeUint16LE(cv, 36, 0)
    writeUint32LE(cv, 38, 0)
    writeUint32LE(cv, 42, offset)
    cd.set(nameBytes, 46)
    central.push(cd)

    offset += local.length + entry.data.length
  }

  const centralSize = central.reduce((a, b) => a + b.length, 0)
  const centralOffset = offset

  // End of central directory
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  writeUint32LE(ev, 0, 0x06054b50)
  writeUint16LE(ev, 4, 0)
  writeUint16LE(ev, 6, 0)
  writeUint16LE(ev, 8, entries.length)
  writeUint16LE(ev, 10, entries.length)
  writeUint32LE(ev, 12, centralSize)
  writeUint32LE(ev, 16, centralOffset)
  writeUint16LE(ev, 20, 0)

  return new Blob([...localParts, ...central, eocd], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
}
