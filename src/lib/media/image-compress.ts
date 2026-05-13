export type ImageCompressOptions = {
  maxLongEdge: number;
  quality: number;
};

const COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function compressImageFile(file: File, options: ImageCompressOptions): Promise<File> {
  if (!COMPRESSIBLE_TYPES.has(file.type)) {
    return file;
  }

  const image = await loadImageElement(file);
  const { width, height } = resolveOutputSize(image.naturalWidth, image.naturalHeight, options.maxLongEdge);

  if (width === image.naturalWidth && height === image.naturalHeight && file.type === 'image/png') {
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);

  const outputType = file.type === 'image/png' ? 'image/webp' : file.type;
  const blob = await canvasToBlob(canvas, outputType, options.quality);
  if (!blob) {
    return file;
  }

  if (blob.size >= file.size) {
    return file;
  }

  return new File([blob], renameFileExtension(file.name, outputType), {
    type: blob.type,
    lastModified: Date.now()
  });
}

function resolveOutputSize(width: number, height: number, maxLongEdge: number): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width, height };
  }

  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function renameFileExtension(fileName: string, mimeType: string): string {
  const extension = mimeTypeToExtension(mimeType);
  if (!extension) {
    return fileName;
  }

  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex < 0) {
    return `${fileName}.${extension}`;
  }

  return `${fileName.slice(0, dotIndex)}.${extension}`;
}

function mimeTypeToExtension(mimeType: string): string | null {
  if (mimeType === 'image/jpeg') {
    return 'jpg';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  if (mimeType === 'image/png') {
    return 'png';
  }

  return null;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像の読み込みに失敗しました。'));
    };

    image.src = url;
  });
}
