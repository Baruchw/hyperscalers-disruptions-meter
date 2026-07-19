import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
createServer(async (req, res) => {
  const path = req.url === '/' ? 'index.html' : req.url.slice(1);
  try { const body = await readFile(join(process.cwd(), path)); res.writeHead(200, { 'content-type': types[extname(path)] || 'text/plain' }); res.end(body); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(5173, () => console.log('Dashboard running at http://localhost:5173'));
