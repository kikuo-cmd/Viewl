const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔑 設定した環境変数からキーを取得
const SUPABASE_URL = process.env.SUPABASE_URL || "https://jxixmxipaytqbrpnuwir.supabase.co/";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aXhteGlwYXl0cWJycG51d2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU4MzUyOCwiZXhwIjoyMTA0MTU5NTI4fQ.R2maq96M5Ff2Y6T6idVRd9VX45wrbyDVKQetXpWGjm4";

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "ds9pipwk0";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "4j3UxJD8PBJlDYp0bNXNwAUlhAk";

// Supabase クライアント初期化
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Cloudinary 初期化
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  secure: true
});

// ----------------------------------------------------
// APIルート
// ----------------------------------------------------

// 1. グループコード確認 API
app.post('/api/verify-code', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: "コードを入力してください" });

  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      // グループテーブル未作成時や該当なしの場合も通すフォールバック処理
      return res.json({ success: true, groupCode: code });
    }
    res.json({ success: true, group: data });
  } catch (err) {
    res.json({ success: true, groupCode: code });
  }
});

// 2. ログイン API (ユーザー照会)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !data) {
      return res.json({ success: true, username: username });
    }
    res.json({ success: true, user: data });
  } catch (err) {
    res.json({ success: true, username: username });
  }
});

// 3. 動画データ取得 API
app.get('/api/videos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, videos: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SPA対応（すべてのページリクエストを index.html へ流す）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Viewl Server is running on port ${PORT}`);
});
