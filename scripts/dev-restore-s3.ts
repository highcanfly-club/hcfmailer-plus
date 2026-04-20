#!/usr/bin/env tsx
/// <reference types="node" />
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createConnection } from "mariadb";
import { parseTar, ParsedTarFileItem } from "nanotar";
import { decompress } from "@napi-rs/lzma/xz";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";

const requiredEnv = [
  "S3_BUCKET",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_ENDPOINT",
  "S3_PATH",
  "MYSQL_HOST",
  "MYSQL_DATABASE",
];

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeKey(key: string): string {
  return key.replace(/\\\\/g, "/").replace(/^[./]+/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRestorePrelude(host: string): string {
  return [
    "-- MariaDB dump 10.19  Distrib 10.11.5-MariaDB, for Linux (aarch64)",
    "--",
    `-- Host: ${host}    Database:`,
    "-- ------------------------------------------------------",
    "-- Server version       8.3.0",
    "",
    "/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;",
    "/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;",
    "/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;",
    "/*!40101 SET NAMES utf8mb4 */;",
    "/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;",
    "/*!40103 SET TIME_ZONE='+00:00' */;",
    "/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;",
    "/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;",
    "/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;",
    "/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;",
    "",
  ].join("\n");
}

function extractDatabaseSection(rawSql: string, database: string): string {
  const lines = rawSql.split(/\r?\n/);
  const startMarker = `-- Current Database: \`${database}\``;
  const startIndex = lines.findIndex((line) => line === startMarker);
  if (startIndex === -1) {
    throw new Error(`Database section not found for ${database}`);
  }

  const endIndex = lines.slice(startIndex + 1).findIndex((line) => line.startsWith("-- Current Database: `"));
  const sliceEnd = endIndex === -1 ? lines.length : startIndex + 1 + endIndex;
  const section = lines.slice(startIndex, sliceEnd).join("\n");
  return section.endsWith("\n") ? section : `${section}\n`;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (body == null) {
    throw new Error("S3 object body is empty");
  }

  if (body instanceof Buffer) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === "string") {
    return Buffer.from(body);
  }

  if (typeof (body as any).arrayBuffer === "function") {
    const arrayBuffer = await (body as any).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (isReadable(body)) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Buffer | string>) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
  }

  if (Symbol.asyncIterator in (body as any)) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as any as AsyncIterable<Uint8Array | string>) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error("Unsupported S3 object body type");
}

function isReadable(value: unknown): value is Readable {
  return typeof value === "object" && value !== null && typeof (value as any).read === "function";
}

async function main(): Promise<void> {
  for (const name of requiredEnv) {
    getEnv(name);
  }

  const S3_BUCKET = getEnv("S3_BUCKET");
  const S3_ACCESS_KEY = getEnv("S3_ACCESS_KEY");
  const S3_SECRET_KEY = getEnv("S3_SECRET_KEY");
  const S3_ENDPOINT = getEnv("S3_ENDPOINT");
  const S3_PATH = getEnv("S3_PATH");
  const MYSQL_HOST = getEnv("MYSQL_HOST");
  const MYSQL_DATABASE = getEnv("MYSQL_DATABASE");
  const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
  const MYSQL_ROOT_PASSWORD = process.env.MYSQL_ROOT_PASSWORD;
  const MYSQL_USER = process.env.MYSQL_USER;
  const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD;

  const dbUser = MYSQL_USER || (MYSQL_ROOT_PASSWORD ? "root" : "root");
  const dbPassword = MYSQL_USER ? MYSQL_PASSWORD ?? "" : MYSQL_ROOT_PASSWORD ?? MYSQL_PASSWORD ?? "";
  const effectiveMysqlHost = MYSQL_HOST === "mysql" ? "127.0.0.1" : MYSQL_HOST;

  const prefix = S3_PATH.replace(/^[\\/]+|[\\/]+$/g, "")
    ? `${S3_PATH.replace(/^[\\/]+|[\\/]+$/g, "")}/`
    : undefined;

  const s3 = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
    forcePathStyle: true,
  });

  console.log("✅ S3 configuration loaded");
  console.log(`ℹ️ Connecting to MySQL host=${effectiveMysqlHost} user=${dbUser}`);

  const listResponse = await s3.send(
    new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      MaxKeys: 1000,
    }),
  );

  const objects = (listResponse.Contents ?? [])
    .filter((item) => item.Key && !item.Key.endsWith("/"))
    .map((item) => item.Key as string);

  if (objects.length === 0) {
    throw new Error(`No objects found in s3://${S3_BUCKET}/${S3_PATH}`);
  }

  objects.sort((a, b) => b.localeCompare(a));
  const latestKey = objects[0];

  console.log(`✅ Latest backup object found: ${latestKey}`);

  const getObject = await s3.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: latestKey }),
  );

  const objectBody = await streamToBuffer(getObject.Body);
  console.log(`✅ Downloaded ${objectBody.length} bytes from S3`);

  const tarData = await decompress(objectBody);
  const tarBuffer = Buffer.from(tarData);
  console.log(`✅ Decompressed xz archive to ${tarBuffer.length} bytes of tar data`);

  const allEntries = parseTar(tarBuffer, { metaOnly: true });
  const appServerFiles = allEntries.filter((entry) => normalizeKey(entry.name).startsWith("app/server/files/"));
  const backupEntries = appServerFiles.filter((entry) => normalizeKey(entry.name).endsWith("backup.sql"));

  if (backupEntries.length === 0) {
    throw new Error("backup.sql not found inside the tar archive");
  }

  const placeholderEntries = appServerFiles.filter(
    (entry) => !normalizeKey(entry.name).endsWith("backup.sql"),
  );

  if (placeholderEntries.length > 0) {
    console.log(`ℹ️ Skipping placeholder extraction for ${placeholderEntries.length} additional app/server/files entries:`);
    for (const entry of placeholderEntries) {
      console.log(`   • ${normalizeKey(entry.name)}`);
    }
  }

  const shouldRestoreFiles = process.env.S3_RESTORE_FILES === "true" || process.env.S3_RESTORE_FILES === "1";
  if (shouldRestoreFiles) {
    console.log("ℹ️ S3_RESTORE_FILES enabled; restoring app/server/files/* to server/files/");
    const fileEntries = parseTar(tarBuffer, {
      metaOnly: false,
      filter: (entry) => normalizeKey(entry.name).startsWith("app/server/files/"),
    }) as ParsedTarFileItem[];

    for (const entry of fileEntries) {
      if (!entry.data) {
        continue;
      }
      const normalizedName = normalizeKey(entry.name);
      const relativePath = normalizedName.slice("app/server/files/".length);
      const outputPath = join(process.cwd(), "server/files", relativePath);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, Buffer.from(entry.data));
      console.log(`✅ Restored file to ${outputPath}`);
    }
  }

  const backupFileEntries = parseTar(tarBuffer, {
    metaOnly: false,
    filter: (entry) => normalizeKey(entry.name).endsWith("backup.sql"),
  }) as ParsedTarFileItem[];

  if (backupFileEntries.length === 0 || !backupFileEntries[0].data) {
    throw new Error("Unable to read backup.sql content from archive");
  }

  const backupData = backupFileEntries[0].data;
  if (!backupData) {
    throw new Error("Unable to read backup.sql content from archive");
  }

  const backupContent = Buffer.from(backupData).toString("utf8");
  console.log("✅ backup.sql loaded into memory");

  const sectionSql = extractDatabaseSection(backupContent, MYSQL_DATABASE);
  const preludeSql = buildRestorePrelude(MYSQL_HOST);
  const databaseSql = `${preludeSql}${sectionSql}`;
  console.log(`✅ Extracted section for database ${MYSQL_DATABASE} and added restore prelude`);

  const connection = await createConnection({
    host: effectiveMysqlHost,
    port: MYSQL_PORT,
    user: dbUser,
    password: dbPassword,
    multipleStatements: true,
    allowPublicKeyRetrieval: true,
  });

  try {
    console.log(`✅ Connected to MariaDB on ${MYSQL_HOST}:${MYSQL_PORT} as ${dbUser}`);
    await connection.query(`DROP DATABASE IF EXISTS \`${MYSQL_DATABASE}\``);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${MYSQL_DATABASE}\``);
    console.log(`✅ Reset database ${MYSQL_DATABASE}`);
    await connection.query(databaseSql);
    console.log(`✅ Imported SQL section for ${MYSQL_DATABASE}`);
  } finally {
    await connection.end();
  }

  console.log("🎉 Restore complete");
}

main().catch((error) => {
  console.error("❌ restore failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
