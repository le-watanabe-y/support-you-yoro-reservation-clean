// Shrinks phone photos before upload so they stay under the 4MB server limit.
// PDFs and formats the browser cannot decode (e.g. HEIC outside Safari) are sent as-is.
const MAX_EDGE = 2000;

export async function prepareUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  if (file.size < 900_000 && file.type !== 'image/heic' && file.type !== 'image/heif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
