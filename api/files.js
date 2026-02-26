const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'ibk-cob-vault-x7q9m';
const TABLE = 'ibk_cob_filemeta_z8r3v';
const MAX_FILES = 20;

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  // DELETE /api/files?id=xxx
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing file id' });

    try {
      const { data: file, error } = await supabase
        .from(TABLE)
        .select('storage_path')
        .eq('id', id)
        .single();

      if (error || !file) return res.status(404).json({ error: 'File not found' });

      await supabase.storage.from(BUCKET).remove([file.storage_path]);
      await supabase.from(TABLE).delete().eq('id', id);

      return res.json({ success: true });
    } catch (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ error: 'Failed to delete file' });
    }
  }

  // GET /api/files
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(MAX_FILES);

      if (error) throw error;
      return res.json(data);
    } catch (err) {
      console.error('List error:', err);
      return res.status(500).json({ error: 'Failed to list files' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
