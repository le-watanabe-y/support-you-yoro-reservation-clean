// Upload validation for medical documents. The declared browser type is never trusted:
// the file signature decides the stored content type.
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

const startsWith = (bytes, signature, offset = 0) => signature.every((value, i) => bytes[offset + i] === value);
const ascii = (bytes, from, to) => String.fromCharCode(...bytes.slice(from, to));

export function sniffDocument(bytes) {
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') return { contentType: 'application/pdf', ext: 'pdf', inline: true };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { contentType: 'image/jpeg', ext: 'jpg', inline: true };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { contentType: 'image/png', ext: 'png', inline: true };
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return { contentType: 'image/webp', ext: 'webp', inline: true };
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heis'].includes(ascii(bytes, 8, 12))) return { contentType: 'image/heic', ext: 'heic', inline: false };
  return null;
}

export const inlineTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
