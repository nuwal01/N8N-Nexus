import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3002;

app.use(express.static('public'));

app.listen(port, () => {
  console.log(`N8N Nexus listening at http://localhost:${port}`);
});
