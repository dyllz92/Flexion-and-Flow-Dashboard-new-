import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENV = {
  OPENAI_API_KEY:      process.env.OPENAI_API_KEY      || process.env.GEMINI_API_KEY || '',
  GOOGLE_CLIENT_ID:    process.env.GOOGLE_CLIENT_ID    || '',
  GOOGLE_CLIENT_SECRET:process.env.GOOGLE_CLIENT_SECRET|| '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  DATA_DIR:            process.env.DATA_DIR            || path.join(process.cwd(), 'data'),
  PORT:                parseInt(process.env.PORT || '3000', 10),
};

// ─── SQLite database setup ────────────────────────────────────────────────────
fs.mkdirSync(ENV.DATA_DIR, { recursive: true });
const db = new Database(path.join(ENV.DATA_DIR, 'soap.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    account_number TEXT PRIMARY KEY,
    id             TEXT UNIQUE NOT NULL,
    data           TEXT NOT NULL,
    email          TEXT,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

  CREATE TABLE IF NOT EXISTS sessions (
    session_id     TEXT PRIMARY KEY,
    account_number TEXT NOT NULL,
    session_date   TEXT NOT NULL,
    data           TEXT NOT NULL,
    saved_at       TEXT NOT NULL,
    FOREIGN KEY (account_number) REFERENCES clients(account_number)
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_number);

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const kv = {
  get(key: string): string | null {
    const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  },
  put(key: string, value: string): void {
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
  },
  del(key: string): void {
    db.prepare('DELETE FROM meta WHERE key = ?').run(key);
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateAccountNumber(): string {
  const now = new Date();
  const ym = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0');
  const counterKey = `counter:${ym}`;
  const raw = kv.get(counterKey);
  const next = raw ? parseInt(raw) + 1 : 1;
  kv.put(counterKey, String(next));
  return `FF-${ym}-${String(next).padStart(4, '0')}`;
}

function findClientByEmail(email: string): any | null {
  if (!email) return null;
  const row = db.prepare('SELECT data FROM clients WHERE email = ?').get(email.toLowerCase()) as { data: string } | undefined;
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}

function getClient(accountNumber: string): any | null {
  const row = db.prepare('SELECT data FROM clients WHERE account_number = ?').get(accountNumber) as { data: string } | undefined;
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}

function saveClient(client: any): void {
  db.prepare(`
    INSERT OR REPLACE INTO clients (account_number, id, data, email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    client.accountNumber,
    client.id,
    JSON.stringify(client),
    client.email?.toLowerCase() || null,
    client.createdAt,
    client.updatedAt
  );
}

function saveSession(session: any): void {
  db.prepare(`
    INSERT OR REPLACE INTO sessions (session_id, account_number, session_date, data, saved_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    session.sessionId,
    session.accountNumber,
    session.sessionDate,
    JSON.stringify(session),
    session.savedAt
  );
}

async function uploadToDrive(
  accessToken: string,
  folderId: string,
  filename: string,
  content: string,
  mimeType: string
): Promise<{ id: string; webViewLink: string } | null> {
  try {
    const metadata = { name: filename, parents: folderId ? [folderId] : [] };
    const boundary = '-------boundary';
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n` +
      content +
      `\r\n--${boundary}--`;

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      }
    );
    if (!res.ok) return null;
    return await res.json() as { id: string; webViewLink: string };
  } catch { return null; }
}

async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret
      })
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.access_token || null;
  } catch { return null; }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // ─── API Routes ──────────────────────────────────────────────────────────────
  app.post('/api/intake-webhook', async (req, res) => {
    try {
      const body = req.body;
      if (!body.firstName || !body.lastName) {
        return res.status(400).json({ error: 'firstName and lastName are required' });
      }
      const profile = {
        id: body.id || crypto.randomUUID(),
        firstName:      String(body.firstName  || '').trim(),
        lastName:       String(body.lastName   || '').trim(),
        email:          String(body.email      || '').trim(),
        phone:          String(body.phone      || '').trim(),
        dob:            String(body.dob        || '').trim(),
        occupation:     String(body.occupation || '').trim(),
        chiefComplaint: String(body.primaryConcern || body.chiefComplaint || '').trim(),
        painIntensity:  body.painIntensity != null ? Number(body.painIntensity) : null,
        medications:    Array.isArray(body.medications) ? body.medications.join(', ') : String(body.medications || '').trim(),
        allergies:      String(body.allergies  || '').trim(),
        medicalConditions: Array.isArray(body.medicalConditions) ? body.medicalConditions.join(', ') : String(body.medicalConditions || '').trim(),
        areasToAvoid:   String(body.areasToAvoid || '').trim(),
        submittedAt:    body.submittedAt || new Date().toISOString(),
        source:         'flexion-intake-form',
      };
      res.json({ success: true, profile });
    } catch (err) {
      res.status(400).json({ error: 'Invalid request body' });
    }
  });

  app.post('/api/generate-soap', async (req, res) => {
    const apiKey = ENV.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const { contextData, intakeData } = req.body;
    
    const prompt = `Generate complete professional SOAP notes for a massage therapy session. Return a JSON object with keys: "subjective", "objective", "assessment", "plan", "therapistNotes".

CLIENT INFORMATION:
- Name: ${contextData.client || 'Not provided'}
- Date of Birth: ${contextData.dob || 'Not provided'}
- Chief Complaint: ${contextData.chiefComplaint || 'Not provided'}
- Pain Level (before session): ${contextData.painBefore || 'Not recorded'}/10
- Pain Level (after session): ${contextData.painAfter || 'Not recorded'}/10
- Session Duration: ${contextData.duration}
- Current Medications: ${contextData.medications || 'None reported'}

INTAKE FORM DATA:
${intakeData || 'No intake form provided'}

MUSCLES ADDRESSED:
${contextData.muscles || 'No specific muscles recorded'}

TECHNIQUES USED:
${contextData.techniques || 'Not specified'}

THERAPIST SESSION SUMMARY:
${contextData.sessionSummary || 'No summary provided'}

CLIENT FEEDBACK:
${contextData.clientFeedback || 'No feedback recorded'}

Generate detailed, clinically appropriate SOAP notes. Use professional massage therapy terminology.

Return JSON with these exact keys:
- "subjective": Patient-reported complaints, pain levels, history, goals. 3-4 clinical sentences.
- "objective": Observable/measurable findings including palpation findings for the listed muscles, range of motion, tissue texture, and postural observations. 4-5 clinical sentences.
- "assessment": Clinical interpretation of findings, tissue response, progress toward goals, and clinical reasoning. 3-4 clinical sentences.
- "plan": Treatment plan including frequency, home care recommendations, areas to focus on next session, and self-care advice. 4-5 clinical sentences.
- "therapistNotes": Any additional clinical notes, contraindications observed, or special considerations. 1-3 sentences.`;

    try {
      // Use Gemini API instead of OpenAI since we have GEMINI_API_KEY
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      
      const content = JSON.parse(response.text || '{}');
      res.json(content);
    } catch (err: any) {
      console.error('AI Generation Error:', err);
      res.status(500).json({ error: `AI error: ${err.message}` });
    }
  });

  app.post('/api/clients', (req, res) => {
    const body = req.body;
    if (!body.firstName && !body.lastName) return res.status(400).json({ error: 'Name required' });

    const email = (body.email || '').toLowerCase().trim();
    let existing: any = null;
    if (email) existing = findClientByEmail(email);

    const now = new Date().toISOString();

    if (existing) {
      const intakeEntry = {
        savedAt: now,
        source: body.source || 'soap-generator',
        data: body.intakeData || {}
      };
      existing.updatedAt = now;
      existing.firstName = body.firstName || existing.firstName;
      existing.lastName = body.lastName || existing.lastName;
      existing.phone = body.phone || existing.phone;
      existing.dob = body.dob || existing.dob;
      existing.occupation = body.occupation || existing.occupation;
      existing.chiefComplaint = body.chiefComplaint || existing.chiefComplaint;
      existing.medications = body.medications || existing.medications;
      existing.allergies = body.allergies || existing.allergies;
      existing.medicalConditions = body.medicalConditions || existing.medicalConditions;
      existing.areasToAvoid = body.areasToAvoid || existing.areasToAvoid;
      existing.intakeForms = [...(existing.intakeForms || []), intakeEntry];
      saveClient(existing);
      return res.status(200).json({ success: true, accountNumber: existing.accountNumber, client: existing, isNew: false });
    }

    const accountNumber = generateAccountNumber();
    const id = body.id || crypto.randomUUID();
    const client = {
      accountNumber, id,
      firstName: body.firstName || '',
      lastName: body.lastName || '',
      email,
      phone: body.phone || '',
      dob: body.dob || '',
      occupation: body.occupation || '',
      chiefComplaint: body.chiefComplaint || '',
      medications: body.medications || '',
      allergies: body.allergies || '',
      medicalConditions: body.medicalConditions || '',
      areasToAvoid: body.areasToAvoid || '',
      createdAt: now,
      updatedAt: now,
      intakeForms: [{ savedAt: now, source: body.source || 'soap-generator', data: body.intakeData || {} }],
      sessionCount: 0,
      lastSessionDate: ''
    };
    saveClient(client);
    res.status(201).json({ success: true, accountNumber, client, isNew: true });
  });

  app.get('/api/clients', (req, res) => {
    const rows = db.prepare(`
      SELECT data FROM clients ORDER BY updated_at DESC LIMIT 500
    `).all() as { data: string }[];

    const clients = rows.map(r => {
      try {
        const c2 = JSON.parse(r.data);
        return {
          accountNumber: c2.accountNumber,
          id: c2.id,
          firstName: c2.firstName,
          lastName: c2.lastName,
          email: c2.email,
          phone: c2.phone,
          dob: c2.dob,
          chiefComplaint: c2.chiefComplaint,
          sessionCount: c2.sessionCount,
          lastSessionDate: c2.lastSessionDate,
          createdAt: c2.createdAt,
          updatedAt: c2.updatedAt
        };
      } catch { return null; }
    }).filter(Boolean);

    res.json({ clients });
  });

  app.get('/api/clients/:accountNumber', (req, res) => {
    const client = getClient(req.params.accountNumber);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  });

  app.put('/api/clients/:accountNumber', (req, res) => {
    const acct = req.params.accountNumber;
    const existing = getClient(acct);
    if (!existing) return res.status(404).json({ error: 'Client not found' });
    const updated = { ...existing, ...req.body, accountNumber: acct, updatedAt: new Date().toISOString() };
    saveClient(updated);
    res.json({ success: true, client: updated });
  });

  app.post('/api/clients/:accountNumber/sessions', (req, res) => {
    const acct = req.params.accountNumber;
    const client = getClient(acct);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const body = req.body;
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    const session = {
      sessionId,
      accountNumber: acct,
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      sessionDate: body.sessionDate || now.split('T')[0],
      duration: body.duration || '',
      musclesTreated: body.musclesTreated || [],
      musclesToFollowUp: body.musclesToFollowUp || [],
      techniques: body.techniques || [],
      soapNote: body.soapNote || { subjective: '', objective: '', assessment: '', plan: '', therapistNotes: '' },
      intakeSnapshot: body.intakeSnapshot || '',
      therapistName: body.therapistName || '',
      therapistCredentials: body.therapistCredentials || '',
      painBefore: body.painBefore || '',
      painAfter: body.painAfter || '',
      chiefComplaint: body.chiefComplaint || '',
      savedAt: now
    };

    saveSession(session);

    client.sessionCount = (client.sessionCount || 0) + 1;
    client.lastSessionDate = session.sessionDate;
    client.updatedAt = now;
    saveClient(client);

    const backupPath = path.join(ENV.DATA_DIR, `session_${acct}_${sessionId.slice(0, 8)}.json`);
    try { fs.writeFileSync(backupPath, JSON.stringify(session, null, 2)); } catch {}

    const driveToken = kv.get('global_drive_refresh_token');
    if (driveToken && ENV.GOOGLE_CLIENT_ID) {
      refreshGoogleToken(driveToken, ENV.GOOGLE_CLIENT_ID, ENV.GOOGLE_CLIENT_SECRET).then(accessToken => {
        if (accessToken) {
          uploadToDrive(
            accessToken,
            ENV.GOOGLE_DRIVE_FOLDER_ID,
            `SOAP_${acct}_${session.sessionDate}_${sessionId.slice(0, 8)}.json`,
            JSON.stringify(session, null, 2),
            'application/json'
          );
        }
      });
    }

    res.json({ success: true, sessionId, session });
  });

  app.get('/api/clients/:accountNumber/sessions', (req, res) => {
    const acct = req.params.accountNumber;
    const rows = db.prepare(`
      SELECT data FROM sessions WHERE account_number = ? ORDER BY session_date DESC LIMIT 100
    `).all(acct) as { data: string }[];

    const sessions = rows.map(r => {
      try { return JSON.parse(r.data); } catch { return null; }
    }).filter(Boolean);

    res.json({ sessions });
  });

  app.get('/api/sessions/:sessionId', (req, res) => {
    const row = db.prepare('SELECT data FROM sessions WHERE session_id = ?').get(req.params.sessionId) as { data: string } | undefined;
    if (!row) return res.status(404).json({ error: 'Session not found' });
    res.json(JSON.parse(row.data));
  });

  app.get('/api/drive/auth', (req, res) => {
    const clientId = ENV.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(500).json({ error: 'Google OAuth not configured' });

    const acct = req.query.account || '';
    const origin = `${req.protocol}://${req.get('host')}`;
    const redirectUri = ENV.GOOGLE_REDIRECT_URI || `${origin}/api/drive/callback`;
    const state = Buffer.from(JSON.stringify({ account: acct, origin })).toString('base64');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file',
      access_type: 'offline',
      prompt: 'consent',
      state
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  app.get('/api/drive/callback', async (req, res) => {
    const code = req.query.code as string;
    const stateRaw = req.query.state as string;
    if (!code) return res.status(400).send('<p>Error: no code returned from Google.</p>');

    let accountNumber = '';
    let origin = '';
    try {
      const parsed = JSON.parse(Buffer.from(stateRaw || '', 'base64').toString());
      accountNumber = parsed.account || '';
      origin = parsed.origin || '';
    } catch {}

    const redirectUri = ENV.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/drive/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: ENV.GOOGLE_CLIENT_ID,
        client_secret: ENV.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenRes.ok) return res.status(400).send('<p>Error exchanging code. Please try again.</p>');

    const tokens: any = await tokenRes.json();
    const refreshToken = tokens.refresh_token;

    if (accountNumber && refreshToken) {
      const client = getClient(accountNumber);
      if (client) {
        client.driveToken = refreshToken;
        client.updatedAt = new Date().toISOString();
        saveClient(client);
      }
    }
    if (refreshToken) kv.put('global_drive_refresh_token', refreshToken);

    res.send(`<!DOCTYPE html><html><body>
      <p style="font-family:sans-serif;padding:20px;">✅ Google Drive connected! You can close this tab.</p>
      <script>
        if (window.opener) {
          window.opener.postMessage({ type: 'DRIVE_AUTH_SUCCESS', account: '${accountNumber}' }, '${origin}');
          setTimeout(() => window.close(), 1500);
        }
      </script>
    </body></html>`);
  });

  app.post('/api/drive/upload-pdf', async (req, res) => {
    const body = req.body;
    const refreshToken = kv.get('global_drive_refresh_token');
    if (!refreshToken) return res.status(400).json({ error: 'Google Drive not connected.' });

    const accessToken = await refreshGoogleToken(refreshToken, ENV.GOOGLE_CLIENT_ID, ENV.GOOGLE_CLIENT_SECRET);
    if (!accessToken) return res.status(400).json({ error: 'Could not refresh Google token' });

    try {
      const bytes = Buffer.from(body.pdfBase64, 'base64');
      const metadata = JSON.stringify({
        name: body.filename,
        mimeType: 'application/pdf',
        parents: ENV.GOOGLE_DRIVE_FOLDER_ID ? [ENV.GOOGLE_DRIVE_FOLDER_ID] : []
      });
      const boundary = 'ff_boundary_xyz';
      const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`;
      const filePart = `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`;
      const endPart = `\r\n--${boundary}--`;

      const combined = Buffer.concat([
        Buffer.from(metaPart),
        Buffer.from(filePart),
        bytes,
        Buffer.from(endPart)
      ]);

      const driveRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: combined as any
        }
      );
      if (!driveRes.ok) {
        const errorText = await driveRes.text();
        console.error('Drive Upload Failed:', errorText);
        return res.status(500).json({ error: 'Drive upload failed' });
      }
      
      const result: any = await driveRes.json();

      if (body.sessionId) {
        const row = db.prepare('SELECT data FROM sessions WHERE session_id = ?').get(body.sessionId) as { data: string } | undefined;
        if (row) {
          const session = JSON.parse(row.data);
          session.pdfDriveFileId = result.id;
          session.pdfDriveUrl = result.webViewLink;
          saveSession(session);
        }
      }

      res.json({ success: true, fileId: result.id, url: result.webViewLink });
    } catch (e) {
      res.status(500).json({ error: 'Drive upload error' });
    }
  });

  app.get('/api/drive/status', (req, res) => {
    const token = kv.get('global_drive_refresh_token');
    res.json({ connected: !!token });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
