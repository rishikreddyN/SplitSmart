const postgres = require('c:/Users/nalla/OneDrive/Documents/SplitSmart/node_modules/postgres');
const fs = require('fs');

const envContent = fs.readFileSync('c:/Users/nalla/OneDrive/Documents/SplitSmart/.env.local', 'utf8');
const dbUrlLine = envContent.split('\n').find(line => line.startsWith('DATABASE_URL='));
const dbUrl = dbUrlLine ? dbUrlLine.split('=')[1].trim().replace(/['"]/g, '') : null;

if (!dbUrl) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = postgres(dbUrl);

async function main() {
  try {
    console.log("=== NOTIFICATIONS ===");
    const notifications = await sql`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50`;
    console.log(notifications);

  } catch (err) {
    console.error("Error querying database:", err);
  } finally {
    await sql.end();
  }
}

main();
