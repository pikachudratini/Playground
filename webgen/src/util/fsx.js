import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  copyFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeText(path, content) {
  ensureDir(dirname(path));
  writeFileSync(path, content, 'utf8');
  return path;
}

export function writeJson(path, data) {
  return writeText(path, `${JSON.stringify(data, null, 2)}\n`);
}

export function readJson(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing file: ${path} — run the earlier step first.`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function readText(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing file: ${path}`);
  }
  return readFileSync(path, 'utf8');
}

export function fileExists(path) {
  return existsSync(path);
}

export function writeBinary(path, buffer) {
  ensureDir(dirname(path));
  writeFileSync(path, buffer);
  return path;
}

export function copyFile(src, dest) {
  if (!existsSync(src)) throw new Error(`Cannot copy missing file: ${src}`);
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
  return dest;
}

// Turns a URL or arbitrary string into a filesystem-safe slug.
export function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'site';
}

// Standard workspace folder for a given source URL.
export function workspaceFor(url, baseDir = resolve(process.cwd(), 'output')) {
  return resolve(baseDir, slugify(url));
}
