import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { preview } from 'vite';

const projectRoot = resolve(import.meta.dirname, '..');
const noticesPath = '/licenses.txt';
const failures = [];
let server;

try {
  server = await preview({
    root: projectRoot,
    preview: {
      host: '127.0.0.1',
      port: 0,
      strictPort: true,
    },
  });

  const address = server.httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Vite preview did not expose a TCP port');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const response = await fetch(new URL(noticesPath, baseUrl), { redirect: 'manual' });
  const contentType = response.headers.get('content-type') ?? '';
  const contentDisposition = response.headers.get('content-disposition') ?? '';
  const body = await response.text();

  if (response.status !== 200) failures.push(`${noticesPath} returned HTTP ${response.status}`);
  if (!/^text\/plain(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
    failures.push(`${noticesPath} has Content-Type ${JSON.stringify(contentType)}, expected text/plain`);
  }
  if (/\battachment\b/i.test(contentDisposition)) {
    failures.push(`${noticesPath} is served as an attachment`);
  }
  if (!body.startsWith('# Licenses')) {
    failures.push(`${noticesPath} does not contain the generated license document`);
  }

  const bundleFiles = (await readdir(resolve(projectRoot, 'dist', 'assets')))
    .filter((file) => file.endsWith('.js'));
  for (const file of bundleFiles) {
    const bundleResponse = await fetch(new URL(`/assets/${file}`, baseUrl));
    const bundle = await bundleResponse.text();
    if (!bundle.includes(`Third-party notices: ${noticesPath}`)) {
      failures.push(`${file} does not point to ${noticesPath}`);
    }
  }

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `${noticesPath} opened over HTTP as ${contentType}; ` +
        `${bundleFiles.length} application bundles point to the canonical notices artifact.`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolveClose) => server.httpServer.close(resolveClose));
}
