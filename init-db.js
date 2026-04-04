import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function init() {
  await client.connect();
  console.log('Connected to DB');

  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'user',
      "createdAt" TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      "lastIntakeDate" TEXT,
      "lastSoapNoteDate" TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      "dueDate" TEXT NOT NULL,
      "clientEmail" TEXT,
      "clientName" TEXT,
      "submissionId" TEXT,
      type TEXT NOT NULL,
      "createdAt" TEXT
    );

    CREATE TABLE IF NOT EXISTS intakes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "submissionId" TEXT NOT NULL,
      "clientName" TEXT NOT NULL,
      "clientEmail" TEXT NOT NULL,
      "clientPhone" TEXT,
      "intakeDate" TEXT NOT NULL,
      "sessionDate" TEXT,
      "pdfUrl" TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      "adminEmail" TEXT NOT NULL,
      "adminId" TEXT NOT NULL,
      timestamp TEXT,
      "targetId" TEXT,
      "targetType" TEXT
    );

    -- Enable Realtime for these tables
    BEGIN;
    DROP PUBLICATION IF EXISTS supabase_realtime;
    CREATE PUBLICATION supabase_realtime;
    COMMIT;
    ALTER PUBLICATION supabase_realtime ADD TABLE clients, tasks, intakes, audit_log;
  `);

  console.log('Tables created and realtime enabled');
  await client.end();
}

init().catch(console.error);
