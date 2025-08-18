import { prisma } from "../database/client";
import slugify from "slugify";
import { HttpError } from "../errors/HttpError";
import sharp from 'sharp';
import { put } from "@vercel/blob";
import { del } from "@vercel/blob";

// New interface for processed image results
export interface ProcessedImageResult {
  imageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}

// Helper function to generate thumbnail URL from main image URL
function generateThumbnailUrl(imageUrl: string): string {
  if (!imageUrl) return "";
  // Garante que não duplique o sufixo -thumb
  if (imageUrl.includes('-thumb.webp')) return imageUrl;
  return imageUrl.replace('.webp', '-thumb.webp');
}

export class PostService {

// Helper function to process and upload an image
async processAndUploadSingleImage(file: Express.Multer.File): Promise<ProcessedImageResult> {
  // Remove a extensão original e cria um nome base
  const originalName = file.originalname;
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, ""); // Remove a extensão
  const fileName = `posts/${Date.now()}-${slugify(nameWithoutExt, { lower: true })}`;
  
  // Define the paths where the images will be saved
  const imagePath = `${fileName}.webp`;
  const thumbnailPath = `${fileName}-thumb.webp`;

  try {
    const imageSharp = sharp(file.buffer);

    // Obtenha os metadados (incluindo dimensões) da imagem original
    const metadata = await imageSharp.metadata();
    // Usamos as dimensões da imagem original para manter a proporção correta
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
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
      thumbnailUrl: thumbnailBlob.url,
      width,
      height,
    };
  } catch (error) {
    console.error('Erro ao processar e fazer upload da imagem:', error);
    throw new HttpError(500, 'Falha no processamento ou upload da imagem');
  }
}


  async create(data: { 
    title: string; 
    subtitle: string; 
    locale: string; 
    blocks: any[]; 
    publishedAt?: string;    
    thumbnailSrc?: string; 
    relatedSlug?: string; 
    thumbnailAlt?: string;
  }) {
    console.log("[Service] PostService.create called with title:", data.title);
    const { title, subtitle, locale, blocks, publishedAt, thumbnailSrc, relatedSlug, thumbnailAlt } = data;

    // Validação básica
    const hasImage = blocks.some(b => b.type === 'image' && b.src);
    if (!hasImage) {
      throw new HttpError(400, "Pelo menos um bloco de imagem com URL é necessário.");
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
      // thumbnailSrc agora é sempre uma URL de imagem principal.
      // Nós geramos a URL do thumbnail a partir dela.
      finalThumbnail = generateThumbnailUrl(thumbnailSrc);
    } else {
      // Se nenhuma thumbnail foi escolhida, pega a primeira imagem do post.
      const firstImageBlock = blocks.find(b => b.type === 'image');
      if (firstImageBlock?.src) {
        finalThumbnail = generateThumbnailUrl(firstImageBlock.src);
      }
    }

    const postData = {
      title,
      slug,
      subtitle,
      locale,
      thumbnail: finalThumbnail,
      thumbnailAlt,
      blocks,
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
        thumbnailAlt: true,
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
    thumbnailSrc?: string;
    relatedSlug?: string;
    thumbnailAlt?: string;
  }) {
    const existingPost = await prisma.post.findUnique({ where: { slug_locale: { slug, locale } } });
    if (!existingPost) throw new HttpError(404, "Post not found.");

    const { title, subtitle, blocks, publishedAt, thumbnailSrc, relatedSlug, thumbnailAlt } = data;    

    const updateData: any = {
      title,
      subtitle,
      blocks,
      publishedAt: publishedAt ? new Date(publishedAt) : existingPost.publishedAt,
      relatedSlug,
      thumbnailAlt,
    };

    // Thumbnail logic during update
  if (thumbnailSrc) {
      updateData.thumbnail = generateThumbnailUrl(thumbnailSrc);
    } else if (!existingPost.thumbnail) {
      // Se não havia thumbnail antes e agora também não foi escolhida,
      // tenta definir a partir da primeira imagem dos blocos atualizados.
      const firstImageBlock = blocks.find(b => b.type === 'image');
      if (firstImageBlock?.src) {
        updateData.thumbnail = generateThumbnailUrl(firstImageBlock.src);
      }
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
    const imageUrlsToDelete: string[] = [];
      if (postExists.thumbnail) {
        imageUrlsToDelete.push(postExists.thumbnail as string);
      }

      // Coleta URLs de imagens dos blocos
      (postExists.blocks as any[]).forEach(block => {
        if (block.type === 'image' && block.src) {
          imageUrlsToDelete.push(block.src);

          // Adiciona a URL do thumbnail correspondente para deleção também
          imageUrlsToDelete.push(generateThumbnailUrl(block.src));
        }
     });

     // Log para debug - adicione isso temporariamente
     console.log('URLs coletadas para deleção:', imageUrlsToDelete);   
   
     // Remove duplicatas e filtra apenas URLs do Vercel Blob
    const uniqueVercelBlobUrls = [...new Set(imageUrlsToDelete)]
      .filter(url => url.includes('blob.vercel-storage.com'));

     console.log('URLs do Vercel Blob para deletar:', uniqueVercelBlobUrls);

     // Deleta apenas as imagens do Vercel Blob
     if (uniqueVercelBlobUrls.length > 0) {
       try {
         await del(uniqueVercelBlobUrls);
         console.log(`Deletadas ${uniqueVercelBlobUrls.length} imagens do Vercel Blob`);
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