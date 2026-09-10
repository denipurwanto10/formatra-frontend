const MAGIC_CHECKERS = {
  pdf: (bytes) => bytesStartWith(bytes, [0x25, 0x50, 0x44, 0x46]), // %PDF
  png: (bytes) => bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47]),
  jpg: (bytes) => bytesStartWith(bytes, [0xff, 0xd8, 0xff]),
  jpeg: (bytes) => bytesStartWith(bytes, [0xff, 0xd8, 0xff]),
  // docx/xlsx/pptx are ZIP containers ("PK\x03\x04" or the empty-archive variant "PK\x05\x06")
  docx: (bytes) => isZipContainer(bytes),
  xlsx: (bytes) => isZipContainer(bytes),
  pptx: (bytes) => isZipContainer(bytes),
};

const DEFAULT_MAX_SIZE_MB = 300;

function bytesStartWith(bytes, signature) {
  if (bytes.length < signature.length) return false;
  return signature.every((b, i) => bytes[i] === b);
}

function isZipContainer(bytes) {
  return bytesStartWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || bytesStartWith(bytes, [0x50, 0x4b, 0x05, 0x06]);
}

function readHeaderBytes(file, length = 8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file.slice(0, length));
  });
}

function extOf(filename) {
  const match = /\.([a-z0-9]+)$/i.exec(filename || "");
  return match ? match[1].toLowerCase() : "";
}

/** Parse an `accept` string like ".pdf,.jpg,.jpeg,.png" into a Set of lowercase extensions. */
export function parseAcceptExtensions(accept) {
  if (!accept) return null;
  return new Set(
    accept
      .split(",")
      .map((s) => s.trim().replace(/^\./, "").toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Validate a File against the tool's accepted extensions, a size limit, and
 * (for known formats) the file's actual magic bytes — catching cases where a
 * user renames an unrelated file to `.pdf` or similar.
 *
 * @param {File} file
 * @param {{accept?: string, maxSizeMB?: number}} options
 * @returns {Promise<{valid: true} | {valid: false, reason: string}>}
 */
export async function validateFile(file, { accept, maxSizeMB = DEFAULT_MAX_SIZE_MB } = {}) {
  if (!file) return { valid: false, reason: "Tidak ada file yang dipilih." };

  if (file.size === 0) {
    return { valid: false, reason: `File "${file.name}" kosong (0 byte).` };
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      reason: `Ukuran file melebihi batas yang didukung (${maxSizeMB} MB).`,
    };
  }

  const allowed = parseAcceptExtensions(accept);
  const ext = extOf(file.name);
  if (allowed && allowed.size > 0 && !allowed.has(ext)) {
    return {
      valid: false,
      reason: `Tipe file .${ext || "?"} tidak didukung. Format yang didukung: ${[...allowed]
        .map((e) => `.${e}`)
        .join(", ")}.`,
    };
  }

  const checker = MAGIC_CHECKERS[ext];
  if (checker) {
    try {
      const header = await readHeaderBytes(file, 8);
      if (!checker(header)) {
        return {
          valid: false,
          reason: `File "${file.name}" tampaknya bukan file .${ext} yang valid (isi file tidak sesuai). File mungkin rusak atau salah diberi nama.`,
        };
      }
    } catch {
      return { valid: false, reason: `Gagal membaca file "${file.name}". File mungkin rusak.` };
    }
  }

  return { valid: true };
}

/**
 * Validate a batch of files, returning the ones that pass plus a list of
 * human-readable reasons for the ones that don't.
 */
export async function validateFiles(files, options) {
  const valid = [];
  const errors = [];
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    const result = await validateFile(file, options);
    if (result.valid) valid.push(file);
    else errors.push(result.reason);
  }
  return { valid, errors };
}
