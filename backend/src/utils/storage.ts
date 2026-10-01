import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { logger } from './logger';

export interface UploadResult {
  url: string;
  storageKey: string;
  bytes: number;
}

const isSupabaseStorageConfigured = Boolean(env.SUPABASE_URL && env.SUPABASE_KEY);
const supabase = isSupabaseStorageConfigured
  ? createClient(env.SUPABASE_URL, env.SUPABASE_KEY)
  : null;

const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

if (isSupabaseStorageConfigured) {
  logger.info('Supabase Storage engine configured.');
} else if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  logger.info('Cloudinary storage engine configured.');
} else {
  logger.warn('Cloud storage not configured. Using local disk storage fallback.');
}

export async function uploadMedicalDocument(
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<UploadResult> {
  const safeFilename = `${Date.now()}-${originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  if (isSupabaseStorageConfigured && supabase) {
    try {
      const bucket = env.SUPABASE_BUCKET || 'medical-records';
      const storagePath = `records/${safeFilename}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType || 'application/octet-stream',
          upsert: false,
        });

      if (error) {
        // If bucket does not exist, attempt to create it
        if (error.message?.includes('Bucket not found') || error.message?.includes('bucket')) {
          await supabase.storage.createBucket(bucket, { public: true });
          const retry = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
            contentType: mimeType || 'application/octet-stream',
          });
          if (retry.error) throw retry.error;
        } else {
          throw error;
        }
      }

      // Generate permanent public URL from Supabase storage
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      const fileUrl = urlData?.publicUrl || `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`;

      logger.info(`Supabase storage upload successful: ${storagePath}`);
      return {
        url: fileUrl,
        storageKey: storagePath,
        bytes: fileBuffer.length,
      };
    } catch (err: any) {
      logger.warn('Supabase storage upload failed, attempting fallback:', err?.message);
    }
  }

  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'medilocker_records',
          resource_type: 'auto',
          filename_override: originalFilename,
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error('Cloudinary upload returned null'));
          }
          resolve({
            url: result.secure_url,
            storageKey: result.public_id,
            bytes: result.bytes,
          });
        }
      );
      uploadStream.end(fileBuffer);
    });
  }

  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, safeFilename);
  await fs.promises.writeFile(filePath, fileBuffer);

  return {
    url: `/uploads/${safeFilename}`,
    storageKey: filePath,
    bytes: fileBuffer.length,
  };
}
