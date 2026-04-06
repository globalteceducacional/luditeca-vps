/**
 * Processamento de imagem com Sharp.
 *
 * Responsabilidades:
 *  - Gerar thumbnail PNG de imagens estáticas e do 1.º frame de GIFs animados.
 *  - Converter uploads para WebP de forma opcional.
 *  - Retornar metadados básicos (largura, altura, formato) sem alterar o original.
 */
import sharp from 'sharp';

export interface ThumbnailOptions {
  /** Largura máxima do thumbnail em px. Default: 400 */
  width?: number;
  /** Altura máxima do thumbnail em px. Default: 300 */
  height?: number;
  /** Qualidade PNG (0-9, compressão). Default: 6 */
  compressionLevel?: number;
}

export interface ImageMeta {
  width: number;
  height: number;
  format: string;
  size: number;
}

/**
 * Retorna `true` se o buffer/mimetype representa um formato de imagem suportado pelo Sharp.
 * Áudio, vídeo e PDFs retornam `false`.
 */
export function isSupportedImageType(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return (
    ct.startsWith('image/') &&
    !ct.includes('svg') // SVG é suportado mas não é raster; não geramos thumb
  );
}

/**
 * Gera um thumbnail PNG a partir do buffer original.
 * Para GIFs animados, extrai apenas o primeiro frame (Sharp abre GIF automaticamente no 1.º frame).
 * Retorna `null` se o formato não for suportado ou ocorrer erro.
 */
export async function generateThumbnail(
  inputBuf: Buffer,
  contentType: string,
  opts: ThumbnailOptions = {},
): Promise<Buffer | null> {
  if (!isSupportedImageType(contentType)) return null;
  const { width = 400, height = 300, compressionLevel = 6 } = opts;
  try {
    const sharpInst = sharp(inputBuf, { animated: false }); // animated:false → 1.º frame de GIF
    const buf = await sharpInst
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel })
      .toBuffer();
    return buf;
  } catch {
    return null;
  }
}

/**
 * Extrai metadados da imagem (dimensões, formato).
 * Retorna `null` se falhar.
 */
export async function getImageMeta(inputBuf: Buffer): Promise<ImageMeta | null> {
  try {
    const meta = await sharp(inputBuf).metadata();
    return {
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      format: meta.format ?? 'unknown',
      size: inputBuf.length,
    };
  } catch {
    return null;
  }
}

/**
 * Converte a imagem para WebP.
 * Retorna `null` se não for suportado ou falhar.
 */
export async function convertToWebP(inputBuf: Buffer, quality = 82): Promise<Buffer | null> {
  try {
    return await sharp(inputBuf).webp({ quality }).toBuffer();
  } catch {
    return null;
  }
}
