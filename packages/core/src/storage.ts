import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageDriver } from './types.js';

export class LocalDriver implements StorageDriver {
  private baseDir: string;

  constructor(baseDir = './uploads') {
    this.baseDir = baseDir;
  }

  async getUploadUrl(key: string, _contentType?: string): Promise<string> {
    const fullPath = join(this.baseDir, key);
    return `file://${fullPath}`;
  }

  async put(
    key: string,
    data: Blob | Buffer | Uint8Array | string,
    _contentType?: string
  ): Promise<void> {
    const fullPath = join(this.baseDir, key);
    await mkdir(dirname(fullPath), { recursive: true });

    if (typeof data === 'string') {
      await writeFile(fullPath, data, 'utf-8');
    } else if (data instanceof Blob) {
      const buffer = Buffer.from(await data.arrayBuffer());
      await writeFile(fullPath, buffer);
    } else {
      await writeFile(fullPath, data);
    }
  }

  async get(key: string): Promise<Uint8Array | null> {
    const fullPath = join(this.baseDir, key);
    if (!existsSync(fullPath)) {
      return null;
    }
    const buffer = await readFile(fullPath);
    return new Uint8Array(buffer);
  }

  async getUrl(key: string): Promise<string> {
    return `/uploads/${key}`;
  }
}

export interface R2Config {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  publicUrl?: string;
}

export class R2Driver implements StorageDriver {
  private client: S3Client;
  private bucket: string;
  private publicUrl?: string;

  constructor(config: R2Config = {}) {
    const accountId = config.accountId ?? process.env.CF_ACCOUNT_ID;
    const accessKeyId = config.accessKeyId ?? process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = config.secretAccessKey ?? process.env.R2_SECRET_ACCESS_KEY;
    this.bucket = config.bucketName ?? process.env.R2_BUCKET_NAME ?? 'cliper-media';
    this.publicUrl = config.publicUrl ?? process.env.R2_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      // Stub warning: will throw on network call if credentials not supplied
      // ponytail: stub mode allows offline testing. Provide valid Cloudflare R2 credentials for production sync.
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
      credentials: {
        accessKeyId: accessKeyId || 'stub-key',
        secretAccessKey: secretAccessKey || 'stub-secret',
      },
    });
  }

  async getUploadUrl(key: string, contentType = 'application/octet-stream'): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }

  async put(
    key: string,
    data: Blob | Buffer | Uint8Array | string,
    contentType = 'application/octet-stream'
  ): Promise<void> {
    let body: any = data;
    if (data instanceof Blob) {
      body = Buffer.from(await data.arrayBuffer());
    } else if (typeof data === 'string') {
      body = Buffer.from(data, 'utf-8');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.client.send(command);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const response = await this.client.send(command);
      if (!response.Body) return null;
      const bytes = await response.Body.transformToByteArray();
      return bytes;
    } catch (e: any) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw e;
    }
  }

  async getUrl(key: string): Promise<string> {
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    }
    return `https://${this.bucket}.r2.cloudflarestorage.com/${key}`;
  }
}

/**
 * Factory for selecting active storage driver via STORAGE env ('local' | 'r2')
 */
export function createStorageDriver(type?: 'local' | 'r2'): StorageDriver {
  const selected = type ?? (process.env.STORAGE === 'r2' ? 'r2' : 'local');
  if (selected === 'r2') {
    return new R2Driver();
  }
  return new LocalDriver();
}
