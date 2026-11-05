/**
 * Image compression and data optimization utilities
 */

export async function compressImage(
  input: string | File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve) => {
    try {
      let src = '';
      if (typeof input === 'string') {
        src = input;
        // If string is already tiny, return directly
        if (!src.startsWith('data:image') || src.length < 50000) {
          return resolve(src);
        }
      } else {
        src = URL.createObjectURL(input);
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          if (typeof input !== 'string') {
            URL.revokeObjectURL(src);
          }

          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (!width || !height) {
            return resolve(typeof input === 'string' ? input : '');
          }

          // If image is already smaller than max bounds, still re-encode if it's very large
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(typeof input === 'string' ? input : '');
          }

          // Fill white background for transparent PNGs converted to JPEG
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch (e) {
          console.warn('Image compression fallback:', e);
          resolve(typeof input === 'string' ? input : '');
        }
      };

      img.onerror = () => {
        if (typeof input !== 'string') {
          URL.revokeObjectURL(src);
        }
        resolve(typeof input === 'string' ? input : '');
      };

      img.src = src;
    } catch (e) {
      console.warn('compressImage error:', e);
      resolve(typeof input === 'string' ? input : '');
    }
  });
}
