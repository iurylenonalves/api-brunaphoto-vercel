import { prisma } from "../database/client";
import slugify from "slugify";
import { HttpError } from "../errors/HttpError";
import sharp from 'sharp';
//import path from 'path';
//import fs from 'fs/promises';
import { put } from "@vercel/blob";
import { del } from "@vercel/blob";

// TODO: Migrate to Vercel Blob storage
//const OUTPUT_DIR = '/tmp/uploads'; // Temporary directory for image processing - NEEDS VERCEL BLOB

// Helper function to process and upload an image
async function processAndUploadImage(file: Express.Multer.File): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  // Ensure the output directory exists /tmp
  //await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const fileName = `posts/${Date.now()}-${slugify(file.originalname, { lower: true })}`;
  
  // Define the new filenames
  // const imageFilename = `${originalFilename}.webp`;
  // const thumbnailFilename = `${originalFilename}-thumb.webp`;

  // Define the paths where the images will be saved
  // const imagePath = path.join(OUTPUT_DIR, imageFilename);
  // const thumbnailPath = path.join(OUTPUT_DIR, thumbnailFilename);

  // Define the paths where the images will be saved
  const imagePath = `${fileName}.webp`;
  const thumbnailPath = `${fileName}-thumb.webp`;

  // Read the file buffer
  // const imageBuffer = await fs.readFile(file.path);

  // // Process the main image from the buffer (resize and convert to webp)
  // await sharp(imageBuffer)
  //   .resize({ width: 1920, withoutEnlargement: true })
  //   .webp({ quality: 80 })
  //   .toFile(imagePath);

  // // Process the thumbnail from the same buffer (resize to 400px and convert to webp)
  // await sharp(imageBuffer)
  //   .resize({ width: 400 })
  //   .webp({ quality: 75 })
  //   .toFile(thumbnailPath);

  // // Remove the original file uploaded by multer
  // await fs.unlink(file.path);

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

    // Process the thumbnail from the same buffer (resize to 400px and convert to webp)
    const thumbnailBuffer = await sharp(file.buffer)
      .resize({ width: 400, fit: 'inside' })
      .webp({ quality: 75 })
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

    // Process all uploaded images in parallel
    let processedImages: { imageUrl: string; thumbnailUrl: string }[] = [];
    try {
      processedImages = await Promise.all(files.map(file => processAndUploadImage(file)));
    } catch (error) {
      console.error('Erro ao processar imagens no create:', error);
      throw new HttpError(500, 'Falha ao processar as imagens');
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

    // The post thumbnail will be the thumbnail of the first image
    // const thumbnail = processedImages.length > 0 ? processedImages[0].thumbnailPath : null;

    let imageIndex = 0;
    const finalBlocks = blocks.map(block => {
      if (block.type === 'image' && processedImages[imageIndex]) {
        // Use the path of the processed main image
        const currentImage = processedImages[imageIndex];
        imageIndex++;
        return { ...block, src: currentImage.imageUrl };
      }
      return block;
    });

    // Thumbnail logic
    let finalThumbnail = null;
    if (thumbnailSrc) {
      // Find the index of the thumbnailSrc in the blocks
      const thumbBlockIndex = blocks.findIndex((b, i) => thumbnailSrc === 'new-image-' + i);
      if (thumbBlockIndex !== -1 && processedImages[thumbBlockIndex]) {
        finalThumbnail = processedImages[thumbBlockIndex].thumbnailUrl;
      }
    }
    // Fallback: if none was chosen, take the first
    if (!finalThumbnail && processedImages.length > 0) {
      finalThumbnail = processedImages[0].thumbnailUrl;
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

    // Process only the new images
    let processedImages: { imageUrl: string; thumbnailUrl: string }[] = [];
    try {
      processedImages = await Promise.all(files.map(file => processAndUploadImage(file)));
    } catch (error) {
      console.error('Erro ao processar novas imagens no update:', error);
      throw new HttpError(500, 'Falha ao processar as novas imagens');
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
          updateData.thumbnail = existingBlock.src.replace('.webp', '-thumb.webp');
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

          // Se não for um thumbnail (não termina com -thumb.webp), adiciona o thumbnail correspondente
          if (!block.src.endsWith('-thumb.webp')) {
            const thumbnailUrl = block.src.replace('.webp', '-thumb.webp');
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