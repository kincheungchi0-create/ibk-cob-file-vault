const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'ibk-cob-vault-x7q9m';
const TABLE = 'ibk_cob_filemeta_z8r3v';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing file id' });

  try {
    const supabase = getSupabase();

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
};
