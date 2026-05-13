export type ImageAspectMode = 'free' | '1:1' | '4:5' | '16:9';

export type CropAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageEditOptions = {
  aspectMode: ImageAspectMode;
  rotation: 0 | 90 | 180 | 270;
  cropPixels?: CropAreaPixels | null;
};

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function applyImageEdits(file: File, options: ImageEditOptions): Promise<File> {
  const shouldEdit = options.rotation !== 0 || options.aspectMode !== 'free' || Boolean(options.cropPixels);
  if (!shouldEdit || !SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return file;
  }

  const image = await loadImageElement(file);
  if (
    options.rotation === 0 &&
    options.aspectMode === 'free' &&
    (!options.cropPixels || isFullImageCrop(options.cropPixels, image.naturalWidth, image.naturalHeight))
  ) {
    return file;
  }

  let workingCanvas = document.createElement('canvas');
  workingCanvas.width = image.naturalWidth;
  workingCanvas.height = image.naturalHeight;
  const sourceContext = workingCanvas.getContext('2d');
  if (!sourceContext) {
    return file;
  }
  sourceContext.drawImage(image, 0, 0);

  if (options.cropPixels) {
    workingCanvas = cropFromCanvas(workingCanvas, options.cropPixels);
  }

  if (options.aspectMode !== 'free' && !options.cropPixels) {
    const cropRect = resolveCenteredCrop({
      width: workingCanvas.width,
      height: workingCanvas.height,
      aspectMode: options.aspectMode
    });
    workingCanvas = cropFromCanvas(workingCanvas, cropRect);
  }

  if (options.rotation !== 0) {
    workingCanvas = rotateCanvas(workingCanvas, options.rotation);
  }

  const blob = await canvasToBlob(workingCanvas, file.type);
  if (!blob) {
    return file;
  }

  return new File([blob], file.name, {
    type: blob.type,
    lastModified: Date.now()
  });
}

function resolveCenteredCrop(params: { width: number; height: number; aspectMode: Exclude<ImageAspectMode, 'free'> }) {
  const { width, height, aspectMode } = params;
  const targetAspect = aspectModeToRatio(aspectMode);
  const currentAspect = width / height;

  if (currentAspect > targetAspect) {
    const cropWidth = Math.max(1, Math.round(height * targetAspect));
    const x = Math.max(0, Math.floor((width - cropWidth) / 2));
    return { x, y: 0, width: cropWidth, height };
  }

  const cropHeight = Math.max(1, Math.round(width / targetAspect));
  const y = Math.max(0, Math.floor((height - cropHeight) / 2));
  return { x: 0, y, width, height: cropHeight };
}

function aspectModeToRatio(mode: Exclude<ImageAspectMode, 'free'>): number {
  if (mode === '1:1') {
    return 1;
  }

  if (mode === '4:5') {
    return 4 / 5;
  }

  return 16 / 9;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, type === 'image/jpeg' ? 0.92 : undefined);
  });
}

function cropFromCanvas(canvas: HTMLCanvasElement, area: CropAreaPixels): HTMLCanvasElement {
  const x = Math.max(0, Math.floor(area.x));
  const y = Math.max(0, Math.floor(area.y));
  const width = Math.max(1, Math.floor(area.width));
  const height = Math.max(1, Math.floor(area.height));

  const safeWidth = Math.min(width, canvas.width - x);
  const safeHeight = Math.min(height, canvas.height - y);

  const output = document.createElement('canvas');
  output.width = Math.max(1, safeWidth);
  output.height = Math.max(1, safeHeight);
  const context = output.getContext('2d');
  if (!context) {
    return canvas;
  }

  context.drawImage(canvas, x, y, output.width, output.height, 0, 0, output.width, output.height);
  return output;
}

function rotateCanvas(source: HTMLCanvasElement, rotation: 0 | 90 | 180 | 270): HTMLCanvasElement {
  if (rotation === 0) {
    return source;
  }

  const rotate90Like = rotation === 90 || rotation === 270;
  const width = rotate90Like ? source.height : source.width;
  const height = rotate90Like ? source.width : source.height;

  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d');
  if (!context) {
    return source;
  }

  context.translate(width / 2, height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return output;
}

function isFullImageCrop(area: CropAreaPixels, width: number, height: number): boolean {
  const tolerance = 2;
  const x = Math.abs(area.x) <= tolerance;
  const y = Math.abs(area.y) <= tolerance;
  const w = Math.abs(area.width - width) <= tolerance;
  const h = Math.abs(area.height - height) <= tolerance;
  return x && y && w && h;
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
