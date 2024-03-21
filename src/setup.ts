import { sql } from './lib/postgres';

async function setup(){
  await sql`
    CREATE TABLE IF NOT EXISTS short_links (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  await sql.end();

  console.log('Setup complete!');
}

setup();
