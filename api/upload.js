const Busboy = require('busboy');
const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'ibk-cob-vault-x7q9m';
const TABLE = 'ibk_cob_filemeta_z8r3v';
const MAX_FILES = 20;
const ALLOWED_EXT = ['.pdf', '.zip', '.docx', '.xlsx', '.doc', '.xls'];
const MAX_SIZE = 50 * 1024 * 1024;

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_SIZE, files: 1 }
    });

    let fileData = null;

    busboy.on('file', (_fieldname, stream, info) => {
      const { filename, mimeType } = info;
      const chunks = [];

      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        fileData = {
          buffer: Buffer.concat(chunks),
          originalname: filename,
          mimetype: mimeType,
          size: Buffer.concat(chunks).length
        };
      });
    });

    busboy.on('finish', () => {
      if (!fileData) return reject(new Error('No file provided'));
      resolve(fileData);
    });

    busboy.on('error', reject);
    req.pipe(busboy);
  });
}

async function pruneOldFiles(supabase) {
  const { data: allFiles, error } = await supabase
    .from(TABLE)
    .select('id, storage_path')
    .order('uploaded_at', { ascending: false });

  if (error || !allFiles) return;

  const toDelete = allFiles.slice(MAX_FILES);
  if (!toDelete.length) return;

  await supabase.storage.from(BUCKET).remove(toDelete.map(f => f.storage_path));
  await supabase.from(TABLE).delete().in('id', toDelete.map(f => f.id));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const file = await parseMultipart(req);

    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return res.status(400).json({ error: 'File type not allowed. Accepted: PDF, DOCX, XLSX, ZIP' });
    }

    const supabase = getSupabase();
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `uploads/${timestamp}_${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadErr) throw uploadErr;

    const { error: insertErr } = await supabase
      .from(TABLE)
      .insert({
        file_name: file.originalname,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.mimetype
      });

    if (insertErr) throw insertErr;

    await pruneOldFiles(supabase);

    res.json({ success: true, message: 'File uploaded' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
};

module.exports.config = { api: { bodyParser: false } };
