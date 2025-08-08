import { prisma } from "../database/client";
import slugify from "slugify";
import { HttpError } from "../errors/HttpError";
import sharp from 'sharp';
import { put } from "@vercel/blob";
import { del } from "@vercel/blob";

// Helper function to generate thumbnail URL from main image URL
function generateThumbnailUrl(imageUrl: string): string {
  if (imageUrl.includes('-thumb.webp')) {
    return imageUrl; // Já é um thumbnail
  }
  return imageUrl.replace('.webp', '-thumb.webp');
}

// Helper function to process and upload an image
async function processAndUploadImage(file: Express.Multer.File): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  // Remove a extensão original e cria um nome base
  const originalName = file.originalname;
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, ""); // Remove a extensão
  const fileName = `posts/${Date.now()}-${slugify(nameWithoutExt, { lower: true })}`;
  
  // Define the paths where the images will be saved
  const imagePath = `${fileName}.webp`;
  const thumbnailPath = `${fileName}-thumb.webp`;

  try {
    // Process the main image from the buffer (resize and convert to webp)
    const imageBuffer = await sharp(file.buffer)
      .resize({ width: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    
    // Save the main image to Vercel Blob storage
    const imageBlob = await put(imagePath, imageBuffer, {
      access: 'public',
      contentType: 'image/webp',
    });

    // Process the thumbnail from the same buffer (resize to 500px and convert to webp)
    const thumbnailBuffer = await sharp(file.buffer)
      .resize({ width: 500, fit: 'inside' })
      .webp({ quality: 85 })
      .toBuffer();

    // Save the thumbnail to Vercel Blob storage 
    const thumbnailBlob = await put(thumbnailPath, thumbnailBuffer, {
      access: 'public',
      contentType: 'image/webp',
    });

    return { 
      imageUrl: imageBlob.url, 
      thumbnailUrl: thumbnailBlob.url
    };
  } catch (error) {
    console.error('Erro ao processar e fazer upload da imagem:', error);
    throw new HttpError(500, 'Falha no processamento ou upload da imagem');
  }
}

export class PostService {
  async create(data: { title: string; subtitle: string; locale: string; blocks: any[]; publishedAt?: string; files: Express.Multer.File[]; thumbnailSrc?: string; relatedSlug?: string }) {
    console.log("[Service] PostService.create called with title:", data.title);
    const { title, subtitle, locale, blocks, publishedAt, files, thumbnailSrc, relatedSlug } = data;

    // Two flows: legacy multipart (files present) vs client-upload (blocks contain blob URLs)
    let processedImages: { imageUrl: string; thumbnailUrl: string }[] = [];
    let finalBlocks = data.blocks;

    if (files && files.length > 0) {
      try {
        processedImages = await Promise.all(files.map(file => processAndUploadImage(file)));
      } catch (error) {
        console.error('Erro ao processar imagens no create:', error);
        throw new HttpError(500, 'Falha ao processar as imagens');
      }

      let imageIndex = 0;
      finalBlocks = data.blocks.map(block => {
        if (block.type === 'image' && processedImages[imageIndex]) {
          const currentImage = processedImages[imageIndex];
          imageIndex++;
          return { ...block, src: currentImage.imageUrl };
        }
        return block;
      });
    } else {
      // Client-upload flow: ensure images have src URLs
      const hasImageUrl = Array.isArray(data.blocks) && data.blocks.some((b: any) => b?.type === 'image' && typeof b?.src === 'string' && b.src);
      if (!hasImageUrl) {
        throw new HttpError(400, 'At least one image URL is required in blocks.');
      }

      // Geração do thumbnail -thumb.webp para o primeiro bloco de imagem
      const firstImageBlock = data.blocks.find((b: any) => b?.type === 'image' && typeof b?.src === 'string' && b.src);
      let generatedThumbUrl: string | null = null;
      if (firstImageBlock && firstImageBlock.src) {
        try {
          // Baixar a imagem original do Blob
          const response = await fetch(firstImageBlock.src);
          if (!response.ok) throw new Error('Falha ao baixar imagem do Blob');
          const buffer = Buffer.from(await response.arrayBuffer());
          // Gerar thumbnail com sharp
          const thumbBuffer = await sharp(buffer)
            .resize({ width: 500, fit: 'inside' })
            .webp({ quality: 85 })
            .toBuffer();
          // Montar path do thumb
          const urlObj = new URL(firstImageBlock.src);
          const pathParts = urlObj.pathname.split("/");
          const fileName = pathParts[pathParts.length - 1];
          const baseName = fileName.replace(/\.webp$/, "");
          const thumbPath = `posts/${baseName}-thumb.webp`;
          // Subir para o Blob
          const { url: thumbUrl } = await put(thumbPath, thumbBuffer, {
            access: 'public',
            contentType: 'image/webp',
          });
          generatedThumbUrl = thumbUrl;
        } catch (err) {
          console.error('Erro ao gerar thumbnail -thumb.webp do Blob:', err);
        }
      }
      // Salvar para uso no thumbnail
  processedImages = [{ imageUrl: firstImageBlock?.src || '', thumbnailUrl: generatedThumbUrl || '' }];
    }

    const slugBase = slugify(title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });    
    const slug = slugBase;

    // Check for duplicate post (same slug and locale)
    const exists = await prisma.post.findUnique({
      where: { slug_locale: { slug, locale } }
    });
    if (exists) {
      throw new HttpError(409, "A post with this title already exists for this locale.");
    }

    // Thumbnail logic
    let finalThumbnail: string | null = null;
    if (thumbnailSrc) {
      // Em ambos os fluxos, thumbnailSrc pode ser "new-image-{i}" (legacy) ou uma URL (client-upload)
      const thumbBlockIndex = data.blocks.findIndex((b, i) => thumbnailSrc === 'new-image-' + i);
      if (thumbBlockIndex !== -1 && processedImages[thumbBlockIndex]) {
        finalThumbnail = processedImages[thumbBlockIndex].thumbnailUrl;
      } else {
        // thumbnailSrc é uma URL de imagem já no Blob
        const existingBlock = finalBlocks.find((b: any) => b?.type === 'image' && b?.src && b.src === thumbnailSrc);
        if (existingBlock && typeof existingBlock.src === 'string') {
          // Tenta achar o thumb gerado
          const thumb = processedImages.find(img => img.imageUrl === existingBlock.src)?.thumbnailUrl;
          finalThumbnail = thumb || generateThumbnailUrl(existingBlock.src);
        }
      }
    }
    // Fallbacks
    if (!finalThumbnail) {
      if (processedImages.length > 0 && processedImages[0].thumbnailUrl) {
        finalThumbnail = processedImages[0].thumbnailUrl;
      } else {
        // Se não conseguiu gerar thumb, usa a imagem original
        const firstImage = finalBlocks.find((b: any) => b?.type === 'image' && b?.src);
        if (firstImage) {
          finalThumbnail = firstImage.src;
        }
      }
    }

    const postData = {
      title,
      slug,
      subtitle,
      locale,
      thumbnail: finalThumbnail,
  blocks: finalBlocks,
      publishedAt: publishedAt ? new Date(publishedAt) : null,
      relatedSlug,
    };

    const newPost = await prisma.post.create({ data: postData });
    return newPost;
  }

  async findAll(locale?: string) {
    const where = locale ? { locale } : {};
    return prisma.post.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        thumbnail: true,
        createdAt: true,
        publishedAt: true,
        locale: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findBySlug(slug: string, locale: string) {
    const post = await prisma.post.findUnique({
      where: {
        slug_locale: {
          slug,
          locale,
        },
      },
    });
    if (!post) {
      throw new HttpError(404, "Post not found.");
    }
    return post;
  }

  async findByRelatedSlug(relatedSlug: string, locale: string) {
    const post = await prisma.post.findFirst({
      where: { 
        slug: relatedSlug, locale 
      },
    });
    if (!post) {
      throw new HttpError(404, "Related post not found.");
    }
    return post;
  }

  async update(slug: string, locale: string, data: { 
    title: string; 
    subtitle: string; 
    blocks: any[];
    publishedAt?: string;
    files?: Express.Multer.File[];
    thumbnailSrc?: string;
    relatedSlug?: string;
  }) {
    const existingPost = await prisma.post.findUnique({ where: { slug_locale: { slug, locale } } });
    if (!existingPost) throw new HttpError(404, "Post not found.");

    const { title, subtitle, blocks, publishedAt, files = [], thumbnailSrc, relatedSlug } = data;

    // Process only the new images (legacy flow); client-upload flow sends ready URLs in blocks
    let processedImages: { imageUrl: string; thumbnailUrl: string }[] = [];
    if (files && files.length > 0) {
      try {
        processedImages = await Promise.all(files.map(file => processAndUploadImage(file)));
      } catch (error) {
        console.error('Erro ao processar novas imagens no update:', error);
        throw new HttpError(500, 'Falha ao processar as novas imagens');
      }
    }
    
    const placeholderPositions: number[] = [];
    blocks.forEach((block, index) => {
      if (block.type === 'image' && block.src === 'image-placeholder') {
        placeholderPositions.push(index);
      }
    });

    let newImageIndex = 0;
  const finalBlocks = blocks.map((block, index) => {
      if (block.type === 'image') {
        if (placeholderPositions.includes(index) && processedImages[newImageIndex]) {
          const result = { ...block, src: processedImages[newImageIndex].imageUrl };
          newImageIndex++;
          return result;
        }
    if (block.src && block.src !== 'image-placeholder') {
          return block;
        }
        // Try to recover from the existing post if there is no new image for this block
        const existingBlock = (existingPost.blocks as any[])[index];
        if (existingBlock?.src) {
          return { ...block, src: existingBlock.src };
        }
        return { ...block, src: null };
      }
      return block;
    });

    const updateData: any = {
      title,
      subtitle,
      blocks: finalBlocks,
      publishedAt: publishedAt ? new Date(publishedAt) : existingPost.publishedAt,
      relatedSlug,
    };

    // Thumbnail logic during update
  if (thumbnailSrc) {
      // If the chosen thumbnail is a new image
      const newImageBlockIndex = blocks.findIndex((b, i) => thumbnailSrc === 'new-image-' + i);
      // Map the block index to the processed images array index
      const processedImageIndex = placeholderPositions.indexOf(newImageBlockIndex);

      if (processedImageIndex !== -1 && processedImages[processedImageIndex]) {
        updateData.thumbnail = processedImages[processedImageIndex].thumbnailUrl;
      } else {
        // If the chosen thumbnail is an existing image, the `thumbnailSrc` will be its path.
        // We need to find the corresponding block to ensure the thumbnail is the -thumb.webp version
        const existingBlock = finalBlocks.find(b => b.src === thumbnailSrc);
        if (existingBlock && typeof existingBlock.src === 'string') {
          // Generate the thumbnail path from the main image path
          updateData.thumbnail = generateThumbnailUrl(existingBlock.src);
        }
      }
    } else if (processedImages.length > 0 && !existingPost.thumbnail) {
      // If no thumbnail was previously set and new images were added, set the first new one as the thumbnail
      updateData.thumbnail = processedImages[0].thumbnailUrl;
    }

    return prisma.post.update({
      where: { slug_locale: { slug, locale } },
      data: updateData,
    });
  }

  async delete(slug: string, locale: string) {
    const postExists = await prisma.post.findUnique({
      where: { slug_locale: { slug, locale } },
    });

    if (!postExists) {
      throw new HttpError(404, "Post to delete not found.");
    }

    // Coleta todas as URLs de imagem do post
    const imageUrls: string[] = [];
      if (postExists.thumbnail) {
        imageUrls.push(postExists.thumbnail as string);
      }

      // Coleta URLs de imagens dos blocos
      (postExists.blocks as any[]).forEach(block => {
        if (block.type === 'image' && block.src) {
          imageUrls.push(block.src);

          // Se não for um thumbnail, adiciona o thumbnail correspondente
          if (!block.src.includes('-thumb.webp')) {
            const thumbnailUrl = generateThumbnailUrl(block.src);
            imageUrls.push(thumbnailUrl);
          }
        }
     });

     // Log para debug - adicione isso temporariamente
     console.log('URLs coletadas para deleção:', imageUrls);
   
     // Filtra apenas URLs do Vercel Blob antes de deletar
     const vercelBlobUrls = imageUrls.filter(url => 
       url.includes('vercel-storage.com') || url.includes('blob.vercel-storage.com')
     );

     console.log('URLs do Vercel Blob para deletar:', vercelBlobUrls);
     
     // Deleta apenas as imagens do Vercel Blob
     if (vercelBlobUrls.length > 0) {
       try {
         await del(vercelBlobUrls);
         console.log(`Deletadas ${vercelBlobUrls.length} imagens do Vercel Blob`);
       } catch (error) {
         console.error('Erro ao deletar imagens do Vercel Blob:', error);
         // Continue com a deleção do post mesmo se falhar ao deletar as imagens
       }
     }

    return prisma.post.delete({
      where: {
        slug_locale: {
          slug,
          locale,
        },
      },
    });
  }
}