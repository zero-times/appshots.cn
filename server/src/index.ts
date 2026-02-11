import { env } from './config/env.js';
import { app } from './app.js';
import { initDatabase } from './db/init.js';

initDatabase();

app.listen(env.port, () => {
  console.log(`[appshots] Server running on http://localhost:${env.port}`);
});
