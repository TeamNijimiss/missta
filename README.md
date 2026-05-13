# みすすた！

Misskeyのメディア投稿をInstagram風に閲覧・投稿するための、軽量PWAフロントエンドです。

## 現在の状態

- Phase 1 (MVP) の初期スキャフォールドを作成済み
- 画面ルーティング雛形、PWA設定、Misskey APIクライアント、各Serviceの雛形を配置
- API接続・UI詳細はこれから実装

## 開発コマンド

```bash
npm install
npm run dev
npm run build
npm run preview
```

## ディレクトリ

- `src/app`: アプリ起動、ルーター、Provider
- `src/features`: 機能ごとのサービス
- `src/lib/misskey`: API/Streaming/型
- `src/lib/storage`: ローカル保存
- `docs`: 設計ドキュメント
