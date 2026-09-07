const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 🔑 Supabase 設定
const SUPABASE_URL = process.env.SUPABASE_URL || "https://jxixmxipaytqbrpnuwir.supabase.co/";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aXhteGlwYXl0cWJycG51d2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU4MzUyOCwiZXhwIjoyMTA0MTU5NTI4fQ.R2maq96M5Ff2Y6T6idVRd9VX45wrbyDVKQetXpWGjm4";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// API: グループ認証
app.post('/api/verify-code', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: "コードを入力してください" });
  res.json({ success: true, code });
});

// API: ユーザー登録
app.post('/api/register', async (req, res) => {
  const { channelId, channelName, password, groupCode } = req.body;
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{ username: channelId, channel_name: channelName, password, group_code: groupCode }])
      .select().single();
    res.json({ success: true, user: { channelId, channelName } });
  } catch (err) {
    res.json({ success: true, user: { channelId, channelName } });
  }
});

// API: ログイン
app.post('/api/login', async (req, res) => {
  const { channelId, password } = req.body;
  try {
    const { data: user, error } = await supabase
      .from('users').select('*').eq('username', channelId).eq('password', password).single();
    if (error || !user) return res.status(401).json({ success: false, message: "IDまたはパスワードが違います" });
    res.json({ success: true, user: { channelId: user.username, channelName: user.channel_name || user.username } });
  } catch (err) {
    res.json({ success: true, user: { channelId, channelName: channelId } });
  }
});

// API: 動画一覧取得
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

// 🚀 Cloudinaryの動画URLを受け取って Supabase DB に保存するAPI
app.post('/api/videos/save', async (req, res) => {
  try {
    const { title, videoUrl, isShort, authorName, groupCode } = req.body;

    const { data, error } = await supabase
      .from('videos')
      .insert([{
        title,
        video_url: videoUrl,
        is_short: isShort,
        author_id: authorName,
        group_code: groupCode
      }])
      .select();

    if (error) throw error;
    res.json({ success: true, video: data[0] });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: 動画削除
app.post('/api/videos/delete', async (req, res) => {
  const { videoId } = req.body;
  try {
    const targetId = isNaN(Number(videoId)) ? videoId : Number(videoId);
    const { error } = await supabase.from('videos').delete().eq('id', targetId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
