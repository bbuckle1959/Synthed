import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createGzip } from "node:zlib";
import { PassThrough } from "node:stream";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Storage } from "@google-cloud/storage";
import type { IOutputSink } from "../core/interfaces.js";

export class StdoutSink implements IOutputSink {
  async write(chunk: string): Promise<void> { process.stdout.write(chunk); }
  async close(): Promise<void> { /* no-op */ }
}

export class FileSink implements IOutputSink {
  private readonly stream: PassThrough;
  private closed = false;
  constructor(path: string, compress = false) {
    this.stream = new PassThrough();
    void mkdir(dirname(path), { recursive: true }).then(() => {
      const ws = createWriteStream(path);
      if (compress) this.stream.pipe(createGzip()).pipe(ws);
      else this.stream.pipe(ws);
    });
  }
  async write(chunk: string): Promise<void> { this.stream.write(chunk); }
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.stream.end();
  }
}

export class S3Sink implements IOutputSink {
  private chunks: string[] = [];
  constructor(private readonly bucket: string, private readonly key: string, private readonly client = new S3Client({})) {}
  async write(chunk: string): Promise<void> { this.chunks.push(chunk); }
  async close(): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.key, Body: this.chunks.join("") }));
  }
}

export class GCSSink implements IOutputSink {
  private chunks: string[] = [];
  constructor(private readonly bucket: string, private readonly key: string, private readonly storage = new Storage()) {}
  async write(chunk: string): Promise<void> { this.chunks.push(chunk); }
  async close(): Promise<void> {
    await this.storage.bucket(this.bucket).file(this.key).save(this.chunks.join(""));
  }
}

