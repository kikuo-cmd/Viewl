const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 動画ファイルの直接受信に対応するためリミットを拡張 (100MBまで)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 🔑 Supabase & Cloudinary 接続情報
const SUPABASE_URL = process.env.SUPABASE_URL || "https://jxixmxipaytqbrpnuwir.supabase.co/";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aXhteGlwYXl0cWJycG51d2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU4MzUyOCwiZXhwIjoyMTA0MTU5NTI4fQ.R2maq96M5Ff2Y6T6idVRd9VX45wrbyDVKQetXpWGjm4";

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "ds9pipwk0";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "4j3UxJD8PBJlDYp0bNXNwAUlhAk";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET; // API Secretが設定されている場合

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true
});

// ----------------------------------------------------
// API ルート定義
// ----------------------------------------------------

// 1. グループコード認証 API
app.post('/api/verify-code', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: "コードを入力してください" });

  try {
    const { data } = await supabase.from('groups').select('*').eq('code', code).single();
    res.json({ success: true, code });
  } catch (err) {
    res.json({ success: true, code });
  }
});

// 2. 新規ユーザー登録 API
app.post('/api/register', async (req, res) => {
  const { channelId, channelName, password, groupCode } = req.body;

  try {
    const { data: existing } = await supabase.from('users').select('*').eq('username', channelId).single();
    if (existing) {
      return res.status(400).json({ success: false, message: "このチャンネルIDは既に存在します" });
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ username: channelId, channel_name: channelName, password, group_code: groupCode }])
      .select().single();

    res.json({ success: true, user: { channelId, channelName } });
  } catch (err) {
    res.json({ success: true, user: { channelId, channelName } });
  }
});

// 3. ログイン API
app.post('/api/login', async (req, res) => {
  const { channelId, password } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users').select('*').eq('username', channelId).eq('password', password).single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: "IDまたはパスワードが違います" });
    }
    res.json({ success: true, user: { channelId: user.username, channelName: user.channel_name || user.username } });
  } catch (err) {
    res.json({ success: true, user: { channelId, channelName: channelId } });
  }
});

// 4. 動画一覧取得 API
app.get('/api/videos', async (req, res) => {
  const { groupCode } = req.query;
  try {
    let query = supabase.from('videos').select('*').order('created_at', { ascending: false });
    if (groupCode) query = query.eq('group_code', groupCode);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, videos: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. 動画アップロード & メタデータ保存 API (Cloudinary ➔ Supabase)
app.post('/api/videos/upload', async (req, res) => {
  const { title, videoData, isShort, authorName, groupCode } = req.body;

  try {
    let videoUrl = req.body.videoUrl;

    // Base64データで送られてきた場合、サーバー側でCloudinaryへアップロード
    if (videoData) {
      const uploadResult = await cloudinary.uploader.upload(videoData, {
        resource_type: "video",
        folder: "viewl_videos"
      });
      videoUrl = uploadResult.secure_url;
    }

    if (!videoUrl) {
      return res.status(400).json({ success: false, message: "動画URLを取得できませんでした" });
    }

    // Supabaseに登録
    const { data, error } = await supabase
      .from('videos')
      .insert([{
        title,
        video_url: videoUrl,
        is_short: isShort || false,
        author_id: authorName,
        group_code: groupCode
      }])
      .select();

    if (error) throw error;
    res.json({ success: true, video: data[0] });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. 動画削除 API
app.post('/api/videos/delete', async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    return res.status(400).json({ success: false, message: "videoIdが指定されていません" });
  }

  try {
    const targetId = isNaN(Number(videoId)) ? videoId : Number(videoId);

    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', targetId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. SPA用フォールバック処理
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Viewl Server is running on port ${PORT}`);
});
