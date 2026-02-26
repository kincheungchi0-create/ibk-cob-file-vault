const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const BUCKET = 'ibk-cob-vault-x7q9m';
const TABLE = 'ibk_cob_filemeta_z8r3v';
const MAX_FILES = 20;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.zip', '.docx', '.xlsx', '.doc', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('File type not allowed. Accepted: PDF, DOCX, XLSX, ZIP'));
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function pruneOldFiles() {
  const { data: allFiles, error } = await supabase
    .from(TABLE)
    .select('id, storage_path')
    .order('uploaded_at', { ascending: false });

  if (error || !allFiles) return;

  const toDelete = allFiles.slice(MAX_FILES);
  if (!toDelete.length) return;

  await supabase.storage.from(BUCKET).remove(toDelete.map(f => f.storage_path));
  await supabase.from(TABLE).delete().in('id', toDelete.map(f => f.id));
  console.log(`Pruned ${toDelete.length} old file(s)`);
}

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const timestamp = Date.now();
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `uploads/${timestamp}_${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadErr) throw uploadErr;

    const { error: insertErr } = await supabase
      .from(TABLE)
      .insert({
        file_name: req.file.originalname,
        storage_path: storagePath,
        file_size: req.file.size,
        mime_type: req.file.mimetype
      });

    if (insertErr) throw insertErr;
    await pruneOldFiles();
    res.json({ success: true, message: 'File uploaded' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

app.get('/api/files', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(MAX_FILES);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

app.get('/api/download', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing file id' });

    const { data: file, error } = await supabase
      .from(TABLE)
      .select('storage_path, file_name')
      .eq('id', id)
      .single();

    if (error || !file) return res.status(404).json({ error: 'File not found' });

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(file.storage_path, 300);

    if (signErr) throw signErr;
    res.json({ url: signed.signedUrl, file_name: file.file_name });
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to generate download link' });
  }
});

app.delete('/api/files', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing file id' });

    const { data: file, error } = await supabase
      .from(TABLE)
      .select('storage_path')
      .eq('id', id)
      .single();

    if (error || !file) return res.status(404).json({ error: 'File not found' });

    await supabase.storage.from(BUCKET).remove([file.storage_path]);
    await supabase.from(TABLE).delete().eq('id', id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

app.listen(PORT, () => {
  console.log(`IBK COB File Vault running on http://localhost:${PORT}`);
});
