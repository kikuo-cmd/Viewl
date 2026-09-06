// ☁️ Cloudinary経由で動画を投稿する処理
async function handleUpload() {
  const title = document.getElementById('uploadTitle').value.trim();
  const isShort = document.getElementById('isShortCheck').checked;
  const uploadBtn = document.getElementById('uploadBtn');

  if (!title) return alert('タイトルを入力してください');
  if (!selectedFile) return alert('動画ファイルを選択してください');

  uploadBtn.innerText = "動画を送信中...";
  uploadBtn.disabled = true;

  try {
    // 1. Cloudinaryへ動画ファイルをアップロード
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('upload_preset', 'ml_default'); // 設定したPreset名
    formData.append('cloud_name', 'ds9pipwk0');

    const cloudRes = await fetch('https://api.cloudinary.com/v1_1/ds9pipwk0/video/upload', {
      method: 'POST',
      body: formData
    });

    const cloudData = await cloudRes.json();
    
    if (!cloudData.secure_url) {
      throw new Error("Cloudinaryへのアップロードに失敗しました");
    }

    // 永続化された動画URLを取得
    const permanentVideoUrl = cloudData.secure_url;

    // 2. Supabaseへタイトルと永続URLを保存
    const res = await fetch('/api/videos/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        videoUrl: permanentVideoUrl,
        isShort,
        authorName: currentUser ? currentUser.channelName : 'ゲスト',
        groupCode: currentGroupCode
      })
    });

    const data = await res.json();
    if (data.success) {
      closeUploadModal();
      loadVideos(); // 一覧を再取得
    } else {
      alert("データベースへの保存に失敗しました");
    }
  } catch (err) {
    console.error(err);
    alert("投稿エラーが発生しました。");
  } finally {
    uploadBtn.innerText = "投稿する";
    uploadBtn.disabled = false;
  }
}
