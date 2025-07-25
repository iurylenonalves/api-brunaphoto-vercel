import { prisma } from "../database/client";
import slugify from "slugify";
import { HttpError } from "../errors/HttpError";
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

// Remember to refactor

const OUTPUT_DIR = 'tmp/uploads'; // Temporary directory for image processing

// Helper function to process and save an image
async function processAndSaveImage(file: Express.Multer.File): Promise<{ imagePath: string; thumbnailPath: string }> {
  // Ensure the output directory exists /tmp
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const originalFilename = path.parse(file.filename).name;
  
  // Define the new filenames
  const imageFilename = `${originalFilename}.webp`;
  const thumbnailFilename = `${originalFilename}-thumb.webp`;

  // Define the paths where the images will be saved
  const imagePath = path.join(OUTPUT_DIR, imageFilename);
  const thumbnailPath = path.join(OUTPUT_DIR, thumbnailFilename);

  // Read the file buffer
  const imageBuffer = await fs.readFile(file.path);

  // Process the main image from the buffer (resize and convert to webp)
  await sharp(imageBuffer)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(imagePath);

  // Process the thumbnail from the same buffer (resize to 400px and convert to webp)
  await sharp(imageBuffer)
    .resize({ width: 400 })
    .webp({ quality: 75 })
    .toFile(thumbnailPath);

  // Remove the original file uploaded by multer
  await fs.unlink(file.path);

  return { 
    imagePath: `uploads/${imageFilename}`, 
    thumbnailPath: `uploads/${thumbnailFilename}`
    //imagePath: imagePath.replace(/\\/g, '/'), 
    //thumbnailPath: thumbnailPath.replace(/\\/g, '/') 
  };
}

export class PostService {
  async create(data: { title: string; subtitle: string; locale: string; blocks: any[]; publishedAt?: string; files: Express.Multer.File[]; thumbnailSrc?: string; }) {
    console.log("[Service] PostService.create called with title:", data.title);
    const { title, subtitle, locale, blocks, publishedAt, files, thumbnailSrc } = data;

    // Process all uploaded images in parallel
    const processedImages = await Promise.all(files.map(file => processAndSaveImage(file)));

    const slugBase = slugify(title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });    
    const slug = `${slugBase}-${Date.now()}`;

    // The post thumbnail will be the thumbnail of the first image
    // const thumbnail = processedImages.length > 0 ? processedImages[0].thumbnailPath : null;

    let imageIndex = 0;
    const finalBlocks = blocks.map(block => {
      if (block.type === 'image' && processedImages[imageIndex]) {
        // Use the path of the processed main image
        const currentImage = processedImages[imageIndex];
        imageIndex++;
        return { ...block, src: currentImage.imagePath };
      }
      return block;
    });

    // Thumbnail logic
    let finalThumbnail = null;
    if (thumbnailSrc) {
      // Find the index of the thumbnailSrc in the blocks
      const thumbBlockIndex = blocks.findIndex((b, i) => thumbnailSrc === 'new-image-' + i);
      if (thumbBlockIndex !== -1 && processedImages[thumbBlockIndex]) {
        finalThumbnail = processedImages[thumbBlockIndex].thumbnailPath;
      }
    }
    // Fallback: if none was chosen, take the first
    if (!finalThumbnail && processedImages.length > 0) {
      finalThumbnail = processedImages[0].thumbnailPath;
    }

    const postData = {
      title,
      slug,
      subtitle,
      locale,
      thumbnail: finalThumbnail,
      blocks: finalBlocks,
      publishedAt: publishedAt ? new Date(publishedAt) : null,
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

  async update(slug: string, locale: string, data: { 
    title: string; 
    subtitle: string; 
    blocks: any[];
    publishedAt?: string;
    files?: Express.Multer.File[];
    thumbnailSrc?: string;
  }) {
    const existingPost = await prisma.post.findUnique({ where: { slug_locale: { slug, locale } } });
    if (!existingPost) throw new HttpError(404, "Post not found.");

    const { title, subtitle, blocks, publishedAt, files = [], thumbnailSrc } = data;

    // Process only the new images
    const processedImages = await Promise.all(files.map(file => processAndSaveImage(file)));
    
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
          const result = { ...block, src: processedImages[newImageIndex].imagePath };
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
    };

    // Thumbnail logic during update
    if (thumbnailSrc) {
      // If the chosen thumbnail is a new image
      const newImageBlockIndex = blocks.findIndex((b, i) => thumbnailSrc === 'new-image-' + i);
      // Map the block index to the processed images array index
      const processedImageIndex = placeholderPositions.indexOf(newImageBlockIndex);

      if (processedImageIndex !== -1 && processedImages[processedImageIndex]) {
        updateData.thumbnail = processedImages[processedImageIndex].thumbnailPath;
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
      updateData.thumbnail = processedImages[0].thumbnailPath;
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