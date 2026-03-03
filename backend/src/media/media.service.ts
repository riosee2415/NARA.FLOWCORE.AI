import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';

@Injectable()
export class MediaService {
  private s3Client: S3Client;
  private cloudFrontDomain: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    this.cloudFrontDomain = process.env.CLOUD_FRONT_DOMAIN;
  }

  async uploadMedia(file: Express.Multer.File, userId: string) {
    const { buffer, originalname } = file;
    const decodedFilename = Buffer.from(originalname, 'latin1').toString(
      'utf8',
    );

    const fileExt = originalname.split('.').pop();
    const key = `${process.env.S3_BASE_PATH}/${userId}/${uuid()}.${fileExt}`;

    const res = await this.s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_MEDIA_S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      name: decodedFilename,
      storageType: `s3`,
      s3: {
        bucket: process.env.AWS_MEDIA_S3_BUCKET_NAME,
        key: key,
        size: res?.Size,
        region: process.env.AWS_REGION,
        endpoint: this.cloudFrontDomain,
        metaData: {
          updatedAt: new Date().toISOString(),
          contentType: file.mimetype,
        },
      },
      cloudFront: {
        url: this.getMediaUrl(key),
      },
    };
  }

  getMediaUrl(key: string) {
    // CLOUD_FRONT_DOMAIN에 프로토콜이 포함되어 있지 않으면 https:// 추가
    const domain = this.cloudFrontDomain.startsWith('http')
      ? this.cloudFrontDomain
      : `https://${this.cloudFrontDomain}`;
    return `${domain}/${key}`;
  }
}
