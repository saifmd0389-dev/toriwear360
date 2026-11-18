import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const bundlePath = path.resolve(process.cwd(), 'dist-server', 'server.mjs');
if (!fs.existsSync(bundlePath)) {
  console.error(
    `[TORIWEAR] Production server bundle not found at ${bundlePath}. Run "npm run build" before starting code.js.`
  );
  process.exit(1);
}

await import(pathToFileURL(bundlePath).href);
