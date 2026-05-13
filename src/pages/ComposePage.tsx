import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, type PercentCrop } from 'react-image-crop';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Crop, Hash, ImagePlus, RotateCw, ShieldAlert, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createMisskeyClient } from '@/services/create-misskey-client';
import { DriveService } from '@/services/drive-service';
import { NoteService, type NoteVisibility } from '@/services/note-service';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';
import { buildNoteText } from '@/lib/format';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { compressImageFile } from '@/lib/media/image-compress';
import { applyImageEdits, type CropAreaPixels, type ImageAspectMode } from '@/lib/media/image-edit';
import { getErrorMessage } from '@/lib/misskey/errors';
import { clearDraft, loadDraft, saveDraft } from '@/lib/storage/drafts';

type FilePreview = {
  id: string;
  file: File;
  url: string;
  isSensitive: boolean;
  comment: string;
  imageEdit: {
    aspectMode: ImageAspectMode;
    rotation: 0 | 90 | 180 | 270;
    cropPercent?: PercentCrop | null;
    cropPixels?: CropAreaPixels | null;
  };
};

export function ComposePage() {
  const navigate = useNavigate();
  const account = useCurrentAccount();
  const initialDraft = useMemo(() => loadDraft(), []);
  const isOnline = useOnlineStatus();
  const [caption, setCaption] = useState(initialDraft?.caption ?? '');
  const [tags, setTags] = useState((initialDraft?.tags ?? []).join(' '));
  const [visibility, setVisibility] = useState<NoteVisibility>(initialDraft?.visibility ?? 'public');
  const [localOnly, setLocalOnly] = useState(Boolean(initialDraft?.localOnly));
  const [isSensitiveForNewFiles, setIsSensitiveForNewFiles] = useState(false);
  const [enableImageCompression, setEnableImageCompression] = useState(true);
  const [compressionLongEdge, setCompressionLongEdge] = useState(1920);
  const [compressionQuality, setCompressionQuality] = useState(0.88);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [editedPreviewUrls, setEditedPreviewUrls] = useState<Record<string, string>>({});
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorTargetId, setEditorTargetId] = useState<string | null>(null);
  const [editorAspectMode, setEditorAspectMode] = useState<ImageAspectMode>('free');
  const [editorRotation, setEditorRotation] = useState<0 | 90 | 180 | 270>(0);
  const [editorCropPercent, setEditorCropPercent] = useState<PercentCrop | null>(null);
  const [editorCropPixels, setEditorCropPixels] = useState<CropAreaPixels | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const previewsRef = useRef<FilePreview[]>([]);
  const editedPreviewUrlsRef = useRef<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorImageRef = useRef<HTMLImageElement | null>(null);
  const client = useMemo(() => createMisskeyClient(account), [account]);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    editedPreviewUrlsRef.current = editedPreviewUrls;
  }, [editedPreviewUrls]);

  useEffect(() => {
    if (previews.length === 0) {
      setActivePreviewId(null);
      setIsEditorOpen(false);
      setEditorTargetId(null);
      return;
    }

    if (!activePreviewId || !previews.some((preview) => preview.id === activePreviewId)) {
      setActivePreviewId(previews[0].id);
    }

    if (editorTargetId && !previews.some((preview) => preview.id === editorTargetId)) {
      setIsEditorOpen(false);
      setEditorTargetId(null);
    }
  }, [activePreviewId, editorTargetId, previews]);

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
      Object.values(editedPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const hasDraft = caption.trim().length > 0 || tags.trim().length > 0 || visibility !== 'public' || localOnly;
    if (!hasDraft) {
      clearDraft();
      return;
    }

    saveDraft({
      caption,
      tags: splitTags(tags),
      visibility,
      localOnly,
      createdAt: new Date().toISOString()
    });
  }, [caption, tags, visibility, localOnly]);

  const services = useMemo(() => {
    if (!client) {
      return null;
    }

    return {
      drive: new DriveService(client),
      note: new NoteService(client)
    };
  }, [client]);

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!services) {
        throw new Error('未ログインです。');
      }

      if (previews.length === 0) {
        throw new Error('投稿するメディアを選択してください。');
      }

      if (!isOnline) {
        throw new Error('オフライン中は投稿できません。');
      }

      const fileIds: string[] = [];
      for (const item of previews) {
        let uploadTarget = item.file;
        if (item.file.type.startsWith('image/')) {
          uploadTarget = await applyImageEdits(uploadTarget, item.imageEdit);
          if (enableImageCompression) {
            uploadTarget = await compressImageFile(uploadTarget, {
              maxLongEdge: compressionLongEdge,
              quality: compressionQuality
            });
          }
        }

        const uploaded = await services.drive.uploadFile(uploadTarget, {
          isSensitive: item.isSensitive,
          comment: item.comment.trim() || undefined
        });
        fileIds.push((uploaded as { id: string }).id);
      }

      const text = buildNoteText(caption, tags);
      const result = await services.note.createNote({
        text,
        fileIds,
        visibility,
        localOnly
      });

      return result as { createdNote?: { id?: string } };
    },
    onSuccess: (result) => {
      previews.forEach((item) => URL.revokeObjectURL(item.url));
      Object.values(editedPreviewUrls).forEach((url) => URL.revokeObjectURL(url));
      setPreviews([]);
      setEditedPreviewUrls({});
      setCaption('');
      setTags('');
      setVisibility('public');
      setLocalOnly(false);
      clearDraft();
      const createdId = result.createdNote?.id;
      if (createdId) {
        navigate(`/notes/${createdId}`);
        return;
      }
      navigate('/home');
    }
  });

  const onFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    addFiles(files);
    event.target.value = '';
  };

  const addFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const accepted = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (accepted.length === 0) {
      setUploadError('画像または動画ファイルを選択してください。');
      return;
    }

    setUploadError(null);
    const next: FilePreview[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      isSensitive: isSensitiveForNewFiles,
      comment: '',
      imageEdit: {
        aspectMode: 'free',
        rotation: 0,
        cropPercent: null,
        cropPixels: null
      }
    }));

    setPreviews((prev) => [...prev, ...next]);
  };

  const onDropFiles = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    if (postMutation.isPending || !isOnline) {
      return;
    }

    const files = Array.from(event.dataTransfer.files ?? []);
    addFiles(files);
  };

  const onDragOverFiles = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (postMutation.isPending || !isOnline) {
      return;
    }

    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const onDragLeaveFiles = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  };

  const removePreview = (previewId: string) => {
    setEditedPreviewUrls((prev) => {
      const next = { ...prev };
      if (next[previewId]) {
        URL.revokeObjectURL(next[previewId]);
        delete next[previewId];
      }
      return next;
    });

    setPreviews((prev) => {
      const target = prev.find((item) => item.id === previewId);
      if (target) {
        URL.revokeObjectURL(target.url);
      }

      return prev.filter((item) => item.id !== previewId);
    });
  };

  const activePreview = useMemo(() => {
    if (!activePreviewId) {
      return null;
    }

    return previews.find((item) => item.id === activePreviewId) ?? null;
  }, [activePreviewId, previews]);

  const editorTargetPreview = useMemo(() => {
    if (!editorTargetId) {
      return null;
    }
    return previews.find((item) => item.id === editorTargetId) ?? null;
  }, [editorTargetId, previews]);

  const activePreviewEditedUrl = activePreview ? editedPreviewUrls[activePreview.id] : undefined;

  useEffect(() => {
    if (!activePreview || !activePreview.file.type.startsWith('image/')) {
      return;
    }

    const targetId = activePreview.id;
    if (!hasPreviewEdits(activePreview)) {
      setEditedPreviewUrls((prev) => {
        if (!prev[targetId]) {
          return prev;
        }
        URL.revokeObjectURL(prev[targetId]);
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      return;
    }

    let cancelled = false;
    const generate = async () => {
      const editedFile = await applyImageEdits(activePreview.file, activePreview.imageEdit);
      if (cancelled) {
        return;
      }
      const url = URL.createObjectURL(editedFile);
      setEditedPreviewUrls((prev) => {
        const current = prev[targetId];
        if (current) {
          URL.revokeObjectURL(current);
        }
        return {
          ...prev,
          [targetId]: url
        };
      });
    };

    void generate();

    return () => {
      cancelled = true;
    };
  }, [
    activePreview,
    activePreview?.id,
    activePreview?.file,
    activePreview?.imageEdit.aspectMode,
    activePreview?.imageEdit.rotation,
    activePreview?.imageEdit.cropPixels?.x,
    activePreview?.imageEdit.cropPixels?.y,
    activePreview?.imageEdit.cropPixels?.width,
    activePreview?.imageEdit.cropPixels?.height
  ]);

  const updatePreview = (previewId: string, updater: (preview: FilePreview) => FilePreview) => {
    setPreviews((prev) => prev.map((item) => (item.id === previewId ? updater(item) : item)));
  };

  const onHeaderPrimary = () => {
    if (previews.length === 0) {
      fileInputRef.current?.click();
      return;
    }
    postMutation.mutate();
  };

  const openEditor = (preview: FilePreview) => {
    if (!preview.file.type.startsWith('image/')) {
      return;
    }

    setEditorTargetId(preview.id);
    setEditorAspectMode(preview.imageEdit.aspectMode);
    setEditorRotation(preview.imageEdit.rotation);
    setEditorCropPercent(preview.imageEdit.cropPercent ?? null);
    setEditorCropPixels(preview.imageEdit.cropPixels ?? null);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditorTargetId(null);
    setEditorCropPercent(null);
    setEditorCropPixels(null);
    editorImageRef.current = null;
  };

  const onEditorImageLoad = (image: HTMLImageElement) => {
    editorImageRef.current = image;
    const initialCrop = editorCropPercent
      ? sanitizePercentCrop(editorCropPercent)
      : createAspectCrop(editorAspectMode, image.naturalWidth, image.naturalHeight);
    setEditorCropPercent(initialCrop);
    setEditorCropPixels(percentCropToNaturalPixels(initialCrop, image));
  };

  const applyEditorChanges = () => {
    if (!editorTargetId) {
      return;
    }

    const sanitizedCrop = editorCropPercent ? sanitizePercentCrop(editorCropPercent) : null;
    const calculatedCropPixels =
      sanitizedCrop && editorImageRef.current
        ? percentCropToNaturalPixels(sanitizedCrop, editorImageRef.current)
        : editorCropPixels;

    updatePreview(editorTargetId, (preview) => ({
      ...preview,
      imageEdit: {
        ...preview.imageEdit,
        aspectMode: editorAspectMode,
        rotation: editorRotation,
        cropPercent: sanitizedCrop,
        cropPixels: calculatedCropPixels
      }
    }));
    closeEditor();
  };

  const onEditorAspectPresetClick = (aspectMode: ImageAspectMode) => {
    setEditorAspectMode(aspectMode);
    const image = editorImageRef.current;
    if (!image) {
      return;
    }
    const widthHint = editorCropPercent ? Math.max(25, Math.min(95, editorCropPercent.width)) : 92;
    const nextCrop = createAspectCrop(aspectMode, image.naturalWidth, image.naturalHeight, widthHint);
    setEditorCropPercent(nextCrop);
    setEditorCropPixels(percentCropToNaturalPixels(nextCrop, image));
  };

  if (!account) {
    return (
      <section className="panel">
        <h1>投稿作成</h1>
        <p className="auth-lead">ログイン情報が見つかりません。インスタンス選択から認証してください。</p>
      </section>
    );
  }

  return (
    <section className="compose-modal-page">
      <section className="compose-modal" role="dialog" aria-label="投稿作成">
        <header className="compose-modal-header">
          <button type="button" className="compose-header-button" onClick={() => navigate('/home')}>
            <ArrowLeft size={24} />
          </button>
          <h1>新規投稿を作成</h1>
          <button
            type="button"
            className="compose-header-primary"
            onClick={onHeaderPrimary}
            disabled={postMutation.isPending || !isOnline}
          >
            {previews.length === 0 ? '選択' : postMutation.isPending ? '投稿中...' : '投稿'}
          </button>
        </header>

        <div className="compose-modal-body">
          <section className="compose-preview-pane">
            {!isOnline ? <p className="form-error">オフライン中は投稿できません。接続後に再試行してください。</p> : null}
            {uploadError ? <p className="form-error">{uploadError}</p> : null}

            <div className="compose-preview-stage-area">
              {activePreview ? (
                <div className="compose-stage-media">
                  {activePreview.file.type.startsWith('image/') ? (
                    <button
                      type="button"
                      className="compose-stage-edit"
                      onClick={() => openEditor(activePreview)}
                      disabled={postMutation.isPending || !isOnline}
                      aria-label="選択中の画像を編集"
                    >
                      <Crop size={15} />
                      編集
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="compose-stage-delete"
                    onClick={() => removePreview(activePreview.id)}
                    disabled={postMutation.isPending || !isOnline}
                    aria-label="選択中のメディアを削除"
                  >
                    <X size={15} />
                  </button>
                  {activePreview.file.type.startsWith('video/') ? (
                    <video src={activePreview.url} controls playsInline />
                  ) : (
                    <img src={activePreviewEditedUrl ?? activePreview.url} alt="preview" />
                  )}
                </div>
              ) : (
                <div
                  className={`compose-empty-stage ${isDragOver ? 'drag-active' : ''}`}
                  onDrop={onDropFiles}
                  onDragOver={onDragOverFiles}
                  onDragLeave={onDragLeaveFiles}
                  onClick={() => {
                    if (postMutation.isPending || !isOnline) {
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                >
                  <ImagePlus size={24} />
                  <p>画像・動画を選択</p>
                  <small>ドラッグ&ドロップでも追加できます</small>
                </div>
              )}
            </div>

            <div className="compose-thumb-strip">
              <button type="button" className="compose-add-button" onClick={() => fileInputRef.current?.click()} disabled={postMutation.isPending || !isOnline}>
                <ImagePlus size={16} />
              </button>
              {previews.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`compose-thumb-item ${activePreviewId === item.id ? 'active' : ''}`}
                  onClick={() => setActivePreviewId(item.id)}
                >
                  {item.file.type.startsWith('video/') ? <video src={item.url} muted playsInline /> : <img src={item.url} alt={item.file.name} />}
                </button>
              ))}
            </div>
          </section>

          <aside className="compose-settings-pane">
            {activePreview ? (
              <>
                <div className="compose-settings-account">
                  {account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : <div className="avatar-fallback" />}
                  <strong>{account.username}</strong>
                </div>

                <section className="compose-settings-section">
                  <h2>投稿内容</h2>
                  <label className="compose-field">
                    <span>投稿範囲</span>
                    <select value={visibility} onChange={(event) => setVisibility(event.target.value as NoteVisibility)} disabled={postMutation.isPending || !isOnline}>
                      <option value="public">パブリック</option>
                      <option value="home">ホーム</option>
                      <option value="followers">フォロワー</option>
                    </select>
                  </label>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      checked={localOnly}
                      onChange={(event) => setLocalOnly(event.target.checked)}
                      disabled={postMutation.isPending || !isOnline}
                    />
                    <span className="settings-switch-track" aria-hidden="true">
                      <span className="settings-switch-thumb" />
                    </span>
                    <span className="settings-switch-label">連合しない</span>
                  </label>
                  <label className="compose-field">
                    <span>キャプション</span>
                    <textarea
                      rows={5}
                      value={caption}
                      onChange={(event) => setCaption(event.target.value)}
                      placeholder="説明文を書いてください"
                      disabled={postMutation.isPending || !isOnline}
                    />
                  </label>

                  <label className="compose-field">
                    <span>
                      <Hash size={15} /> ハッシュタグ
                    </span>
                    <input
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="example, misskey"
                      disabled={postMutation.isPending || !isOnline}
                    />
                  </label>
                </section>

                <section className="compose-settings-section">
                  <h2>現在のファイル設定</h2>
                  <label className="compose-check">
                    <input
                      type="checkbox"
                      checked={activePreview.isSensitive}
                      onChange={(event) =>
                        updatePreview(activePreview.id, (preview) => ({
                          ...preview,
                          isSensitive: event.target.checked
                        }))
                      }
                      disabled={postMutation.isPending || !isOnline}
                    />
                    <ShieldAlert size={15} />
                    センシティブとして投稿
                  </label>

                  <label className="compose-field">
                    <span>ファイルコメント</span>
                    <input
                      value={activePreview.comment}
                      onChange={(event) =>
                        updatePreview(activePreview.id, (preview) => ({
                          ...preview,
                          comment: event.target.value
                        }))
                      }
                      placeholder="画像説明や補足（任意）"
                      disabled={postMutation.isPending || !isOnline}
                    />
                  </label>
                  {activePreview.file.type.startsWith('image/') ? (
                    <p className="compose-hint">
                      編集: {activePreview.imageEdit.aspectMode === 'free' ? '自由' : activePreview.imageEdit.aspectMode} / 回転 {activePreview.imageEdit.rotation}°
                    </p>
                  ) : null}
                </section>

                <section className="compose-settings-section">
                  <h2>追加ファイルの初期設定</h2>
                  <label className="compose-check">
                    <input
                      type="checkbox"
                      checked={isSensitiveForNewFiles}
                      onChange={(event) => setIsSensitiveForNewFiles(event.target.checked)}
                      disabled={postMutation.isPending || !isOnline}
                    />
                    <ShieldAlert size={15} />
                    これから追加するファイルをセンシティブにする
                  </label>
                </section>

                <section className="compose-settings-section">
                  <h2>アップロード最適化</h2>
                  <label className="compose-check">
                    <input
                      type="checkbox"
                      checked={enableImageCompression}
                      onChange={(event) => setEnableImageCompression(event.target.checked)}
                      disabled={postMutation.isPending || !isOnline}
                    />
                    画像を圧縮
                  </label>
                  {enableImageCompression ? (
                    <div className="compose-compression-grid">
                      <label className="compose-field">
                        <span>長辺サイズ</span>
                        <select
                          value={compressionLongEdge}
                          onChange={(event) => setCompressionLongEdge(Number(event.target.value))}
                          disabled={postMutation.isPending || !isOnline}
                        >
                          <option value={1280}>1280 px</option>
                          <option value={1920}>1920 px</option>
                          <option value={2560}>2560 px</option>
                        </select>
                      </label>

                      <label className="compose-field">
                        <span>画質</span>
                        <select
                          value={compressionQuality}
                          onChange={(event) => setCompressionQuality(Number(event.target.value))}
                          disabled={postMutation.isPending || !isOnline}
                        >
                          <option value={0.76}>標準（軽量）</option>
                          <option value={0.88}>高画質</option>
                          <option value={0.95}>最高画質</option>
                        </select>
                      </label>
                    </div>
                  ) : null}
                </section>

                <section className="compose-settings-section">
                  <h2>ファイル管理</h2>
                  <ul className="compose-file-list-compact">
                    {previews.map((item) => (
                      <li key={item.id}>
                        <span>{item.file.name}</span>
                        <button type="button" className="icon-action-button" onClick={() => removePreview(item.id)} disabled={postMutation.isPending || !isOnline}>
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : (
              <div className="compose-settings-empty">
                <p>投稿するメディアを選択すると、ここに設定項目が表示されます。</p>
              </div>
            )}

            {postMutation.isError ? <p className="form-error">{getErrorMessage(postMutation.error, '投稿に失敗しました。')}</p> : null}
          </aside>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={onFilesChange}
          disabled={postMutation.isPending || !isOnline}
          style={{ display: 'none' }}
        />

        {isEditorOpen && editorTargetPreview && editorTargetPreview.file.type.startsWith('image/') ? (
          <div className="compose-editor-overlay" role="dialog" aria-label="画像編集">
            <section className="compose-editor-modal">
              <header className="compose-editor-header">
                <button type="button" className="compose-header-button" onClick={closeEditor}>
                  <X size={22} />
                </button>
                <h2>画像編集</h2>
                <button type="button" className="compose-header-primary" onClick={applyEditorChanges}>
                  反映
                </button>
              </header>

              <div className="compose-editor-body">
                <div className="compose-cropper-wrap">
                  <ReactCrop
                    crop={editorCropPercent ?? undefined}
                    aspect={getCropAspect(editorAspectMode)}
                    keepSelection
                    minWidth={24}
                    disabled={postMutation.isPending || !isOnline}
                    onChange={(_, percentCrop) => setEditorCropPercent(sanitizePercentCrop(percentCrop))}
                    onComplete={(_, percentCrop) => {
                      const sanitized = sanitizePercentCrop(percentCrop);
                      setEditorCropPercent(sanitized);
                      if (editorImageRef.current) {
                        setEditorCropPixels(percentCropToNaturalPixels(sanitized, editorImageRef.current));
                      }
                    }}
                  >
                    <img src={editorTargetPreview.url} alt="edit preview" ref={editorImageRef} onLoad={(event) => onEditorImageLoad(event.currentTarget)} />
                  </ReactCrop>
                </div>

                <div className="compose-editor-toolbar">
                  <div className="compose-aspect-buttons" role="group" aria-label="トリミング比率">
                    {(['free', '1:1', '4:5', '16:9'] as const).map((aspect) => (
                      <button
                        key={aspect}
                        type="button"
                        className={editorAspectMode === aspect ? 'active' : ''}
                        disabled={postMutation.isPending || !isOnline}
                        onClick={() => onEditorAspectPresetClick(aspect)}
                      >
                        {aspect === 'free' ? '自由' : aspect}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="secondary-icon-button"
                    disabled={postMutation.isPending || !isOnline}
                    onClick={() => setEditorRotation((prev) => (((prev + 90) % 360) as 0 | 90 | 180 | 270))}
                  >
                    <RotateCw size={15} />
                    回転 {editorRotation}°
                  </button>
                  <p className="compose-hint">再度「編集」を押すとこの状態から続きの編集ができます。</p>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function splitTags(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCropAspect(mode: ImageAspectMode): number | undefined {
  if (mode === 'free') {
    return undefined;
  }

  if (mode === '1:1') {
    return 1;
  }

  if (mode === '4:5') {
    return 4 / 5;
  }

  return 16 / 9;
}

function createAspectCrop(mode: ImageAspectMode, width: number, height: number, widthPercent = 92): PercentCrop {
  if (mode === 'free') {
    return {
      unit: '%',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    };
  }

  const aspect = getCropAspect(mode) ?? 1;
  const draft = makeAspectCrop({ unit: '%', width: Math.max(25, Math.min(95, widthPercent)) }, aspect, width, height);
  return centerCrop(draft, width, height);
}

function percentCropToNaturalPixels(crop: PercentCrop, image: HTMLImageElement): CropAreaPixels {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const xPercent = Math.max(0, Math.min(100, crop.x));
  const yPercent = Math.max(0, Math.min(100, crop.y));
  const maxWidthPercent = Math.max(0, 100 - xPercent);
  const maxHeightPercent = Math.max(0, 100 - yPercent);
  const widthPercent = Math.max(0.1, Math.min(maxWidthPercent, crop.width));
  const heightPercent = Math.max(0.1, Math.min(maxHeightPercent, crop.height));

  const x = Math.round((xPercent / 100) * naturalWidth);
  const y = Math.round((yPercent / 100) * naturalHeight);
  const width = Math.max(1, Math.round((widthPercent / 100) * naturalWidth));
  const height = Math.max(1, Math.round((heightPercent / 100) * naturalHeight));

  return {
    x,
    y,
    width: Math.min(width, naturalWidth - x),
    height: Math.min(height, naturalHeight - y)
  };
}

function sanitizePercentCrop(crop: PercentCrop): PercentCrop {
  const x = Number.isFinite(crop.x) ? crop.x : 0;
  const y = Number.isFinite(crop.y) ? crop.y : 0;
  const width = Number.isFinite(crop.width) ? crop.width : 100;
  const height = Number.isFinite(crop.height) ? crop.height : 100;

  const clampedX = Math.max(0, Math.min(99.9, x));
  const clampedY = Math.max(0, Math.min(99.9, y));
  const maxWidth = Math.max(0.1, 100 - clampedX);
  const maxHeight = Math.max(0.1, 100 - clampedY);
  const clampedWidth = Math.max(0.1, Math.min(maxWidth, width));
  const clampedHeight = Math.max(0.1, Math.min(maxHeight, height));

  return {
    unit: '%',
    x: clampedX,
    y: clampedY,
    width: clampedWidth,
    height: clampedHeight
  };
}

function hasPreviewEdits(preview: FilePreview): boolean {
  return preview.imageEdit.rotation !== 0 || preview.imageEdit.aspectMode !== 'free' || Boolean(preview.imageEdit.cropPixels);
}
