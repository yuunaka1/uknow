# Changelog

## [2.0.1] - 2026-05-23
### Added
- **Settings (設定)**:
  - 利用可能な Gemini モデルの選択肢に次世代標準の **`gemini-3.5-flash`** を追加し、アプリケーション全体のデフォルトモデルに設定。
  - 非推奨プレビュー版の `gemini-3.1-flash-lite-preview` および `gemini-3-flash-preview` を削除し、新たに安定高速モデルである **`gemini-3.1-flash-lite`** を追加。
  - Gemini 音声（`voice_name`）の選択欄に合計30種類のキャラクターを追加し、それぞれに日本語での声質・キャラクターイメージの特徴説明（例：「明るい」「しっかりした」「優しい」等）を表示。
  - 選択した音声の声をその場で試聴できる **「🔊 サンプル再生」ボタン** を実装。APIのAUDIO出力（音声合成）機能を利用して、リアルタイムでサンプル挨拶を生成・再生可能に。

### Fixed
- **AI 専属コーチ (Teacher)**: WebSocket接続時のモデルを非推奨の `gemini-2.0-flash-exp` から最新の `models/gemini-3.1-flash-live-preview` にアップデートし、レッスン開始時に発生していた接続エラー（`Disconnect code: 1008`）を解消。

## [2.0.0] - 2026-05-24
### Changed
- **Documentation**: 全体的なドキュメント（README.md）の見直しを実施。
  - 装飾的・宣伝的な表現や「ハッカー風」といった記述を削除し、事実ベースの落ち着いたトーンに統一。
  - UIのスクリーンショット画像をすべて削除。
  - 各機能名の表記を英語から日本語へと翻訳・統一。
  - 各機能を表す絵文字をアプリ内メニューのアイコンと親和性のあるものに統一。

## [1.16.0] - 2026-05-23
### Added
- **AI Teacher**: Added new interactive AI Teacher feature that reads your Flashcard Google Docs notes.
  - Supports selectable lesson durations (10, 20, 30 minutes).
  - Uses the Gemini Live API for real-time natural voice conversations.
  - Automatically evaluates the student's weaknesses at the end of the lesson and saves the profile to personalize future lessons.

## [1.15.2] - 2026-05-22
### Fixed
- **Shadowing**: Fix Shadowing playback audio quality.

## [1.15.1] - 2026-05-09
### Fixed
- **UI/UX**: Improved vertical spacing and layout of Markdown content (Help pages and session feedback), specifically increasing margins for `H2`, `H3`, lists, and horizontal rules (`hr`).

## [1.15.0] - 2026-05-09
### Added
- **Tuning Mode (Pronunciation Training)**: Added a new real-time pronunciation training mode (formerly requested as Pronunciation mode).
  - Features an interactive turn-based loop that presents English sentences focused on specific pronunciation themes (e.g., R/L, Intonation, Word Stress).
  - Connects to the Gemini Multimodal Live API to provide immediate, concise AI feedback in Japanese evaluating the user's spoken pronunciation.
  - Generates an end-of-session reflective summary providing actionable advice on targeted sounds.

## [1.14.0] - 2026-04-22
### Added
- **Infinite Dynamic AI Photo Generation**: Photo Description mode now dynamically generates infinite, completely unique TOEIC-style stock photos on-demand.
  - Leverages a two-step AI chain: Gemini Generative API writes a photographic prompt, which is then rendered by Pollinations AI silently in the background.

## [1.13.1] - 2026-04-21
### Fixed
- **Photo Description**: Fixed an issue where photo image links returned 404 on GitHub Pages by properly converting absolute asset paths to relative paths.

## [1.13.0] - 2026-04-21
### Added
- **Photo Description Practice**: A new TOEIC Speaking-style guided training mode.
  - Presents a TOEIC-style photo with a 45-second preparation timer and a 45-second speaking timer.
  - Interacts with Gemini Multimodal API directly using the recorded browser audio and image data.
  - Provides strict TOEIC-aligned feedback (transcription, fluency, missing details, grammar/vocabulary improvements, and a high-score model answer).

### Changed
- **Reflex Mode Context Diversity**: Drastically strengthened the system prompt to force the AI to switch to completely different contexts, vocabulary, and grammar situations whenever the user answers a training question perfectly, avoiding repetitive sentence structures.

## [1.12.9] - 2026-04-19
### Changed
- **Reflex Mode Turn-Taking**: Adjusted the end-of-utterance silence threshold (`silenceDurationMs`) in the Live API configuration to wait longer before the AI responds. This reduces premature interruptions and gives the user more time to finish speaking.
- **Reflex Repeat-after-Correction**: Improved the Reflex system prompt to explicitly require the AI to prompt the user to repeat the correct English sentence aloud after making a grammatical or phrasing mistake.

## [1.10.0] - 2026-04-18
### Added
- **Reflex Session Feedback**: Automatically generates a reflective summary and feedback report immediately after ending a Reflex session. The feedback analyzes your strengths, weaknesses, and gives concrete suggestions based on your practice.
## [1.9.1] - 2026-04-18
### Changed
- Translated Reflex Mode grammar theme labels to Japanese to optimize UI width.
## [1.9.0] - 2026-04-18
### Added
- **Reflex Grammar Theme Selection**: Added an optional dropdown to Reflex mode that allows users to pick a specific grammar target (e.g. Present Perfect, Passive Voice, Conditionals). When selected, Reflex prompts will naturally focus on reinforcing the chosen grammar.
## [1.8.0] - 2026-04-18
### Added
- **GoTanakaKei (Personal Topics Training)**: A new guided speaking practice feature.
  - Choose from 16 preset topics (School, Job, Values, etc.) or add custom topics.
  - Auto-generate structured Japanese outlines and natural English conversational scripts using AI based on your notes.
  - Features real-time voice interview mode (Japanese) to brainstorm and gather notes.
  - Features real-time voice practice mode (English) simulating a live conversation.
  - Detailed grammar, styling, and fluency feedback.
  - JSON state Export/Import for topic progress.
All notable changes to this project will be documented in this file.

## [1.7.0] - 2026-04-18

### ✨ Major Features
- **Reflex (瞬間英作文トレーニング)**: Gemini Multimodal Live APIを利用した新しい英語スピーキング特訓モードを実装しました (Issue #23)。
  - 「CEFR A1〜C2」までのレベルを選択することで、指定難易度に合わせた日本語がAIから出題されるインタラクティブセッションを提供します。
  - 英語で発話した直後に、「良かった点」「不自然な箇所の指摘」「ネイティブな別表現の提案」のフィードバックが音声で返ってくる連続トレーニングループを実現しました。
- **Monologue Mode Refactoring**: 古い REST APIベースの `MonologueREST.tsx` コンポーネントを完全に削除し、超低遅延 Live API ベースのストリーミング版を正式な `Monologue` 機能として改名・統合しました。
- `SettingsPanel` から、完全に非推奨・未使用となっていた `translationModel` の設定項目・状態管理をクリーンアップしました。
- アプリ共通のインフラコード（24kHz スピーカー再生機構、16kHz マイク録音機構）を `src/utils/audioUtils.ts` へ抽出し、アーキテクチャの拡張性を改善しました。

## [1.6.0] - 2026-04-17

### 🚀 Major Features
- **Gemini Live Mode**: BidiGenerateContent (Gemini Multimodal Live API)に対応した新しい双方向リアルタイム対話機能「LIVE」メニューを実装しました。
  - RESTや旧式のAPIではなく、WebSocketプロトコルを使用した純粋なフルストリーミング通信を採用しています。
  - マイクロフォン入力は独自の ScriptProcessor (AudioWorklet互換) パイプラインを経由して `16kHz PCM` フォーマットにリアルタイムエンコードされ、常時送信されます。
  - ボットからの返答音声を `24kHz PCM` でリアルタイムに受信し、`AudioContext` のキューを利用して連続再生（ストリーミング出力）します。
  - ユーザーが話しかけた瞬間にAPIから送信される `interrupted` 信号を検知し、瞬時にボットの再生を破棄・停止させる「Barge-in（割り込み）」に対応しています。
  - 指定モデルを `models/gemini-3.1-flash-live-preview` にアップデートし、最新のマルチモーダル機能の恩恵を受けられるように設定しました。

## [1.5.21] - 2026-04-17

### ✨ Features
- **Monologue**: **インプットの完全非同期化とキャンセル機能を実装！ (Issues #21, #22)**
  - **Issue #21 (Non-blocking Queue)**: ユーザー入力（STT）と、API翻訳・音声再生出力（TTS）の処理フローを完全に分離し、キュー（Queue）システムを導入しました。これにより、ボットが翻訳中や読み上げ中であってもマイクが遮断されず、待つことなく次々と日本語を喋り続けて（ストックして）いくことが可能になりました。
  - **Issue #22 (Cancel Ability)**: 各発話ログの横に `[ CANCEL ]` ボタンを新設。もし日本語の音声入力が誤認識されてしまった場合、翻訳・読み上げが完了する前であればボタン一つでその処理を即座に破棄（アボート）できるようになりました。
  - 上記の機能追加に伴い、ログの表示を「ユーザーとボットのバラバラの行」から「1フレーズごとのカード形式」へ統合し、ステータス（翻訳中・読み上げ中・完了・キャンセル等）がリアルタイムに可視化されるUIにリファクタリングしています。

## [1.5.20] - 2026-04-17

### ✨ Features & UI/UX Improvements
- **Monologue**:
  - 旧WebSocket通信ベースの `LiveTranslation` 機能・ファイルを完全に削除し、メニューの「MONOLOGUE」ボタンから直接超低遅延のREST&NativeTTS版が開くようにアプリ全体のUIとルーティングを一本化しました。
  - ログ画面の表示領域を少しでも広く確保するため、画面上部の余分なサブタイトル（テキストモデルの説明文）を削除しました。
  - ボットからの英語テキスト出力が不必要に大きく表示されていたスタイル設定を解除し、日本語の入力ログと「文字サイズ・行間」を完全に統一しました。色（緑とグレー）の違いのみで見分けがつく、よりクリーンなログ形式になりました。

## [1.5.19] - 2026-04-17

### 🐛 Bug Fixes
- **Code Quality**: `MonologueREST.tsx` に不要に残っていた `modelName` prop 定義や、`LogEntry` インターフェースの微細な TypeScript エラーを修正し、デプロイ用ビルドのLintルール警告を完全に解消しました。

## [1.5.18] - 2026-04-17

### ✨ Features
- **Monologue 2**: **「超低遅延」特化の A モードへ完全移行しました！**
  GeminiのTTS（音声生成）API通信を完全に廃止し、ブラウザ標準の Native Speech Synthesis (Web Speech API) を使用するようにバックエンド処理を書き換えました。
  これにより、翻訳テキストが出た瞬間にラグなし（遅延ゼロ）ですぐに読み上げが開始される、超機敏なレスポンスが実現されています。

## [1.5.17] - 2026-04-17

### 🐛 Bug Fixes
- **State Management**: `useLocalStorage` カスタムフック内で関数型の状態更新 (`setLogs(prev => ...)`) を行った際に、Reactのクロージャ機能によって過去のステート(Stale State)にフォールバックしてしまい、連続したログの記録（日本語と英語の記録など）で上書きが発生してしまう潜在的なバグを修正しました。

## [1.5.16] - 2026-04-17

### ✨ Features
- **Monologue 2**:
  - **ログの永続化**: やり取りのログを常時残すため、Local Storage に最新100件まで自動でキャッシュ（保存）されるように変更しました。ページをリロードしてもログが消えなくなりました。
  - 合わせて、蓄積したログを手動で消去できる `[CLEAR]` ボタンをログパネル右上に新設しました。
  - **TTSプロンプトのシンプル化**: 第1フェーズですでに適切な英語に翻訳されているため、第2フェーズの音声生成（TTS）に対しては、「ゆっくり分かりやすく」や「翻訳して」という修飾指示を省き、純粋にテキストデータのみをプレーンに渡すようプロンプトを整理しました。

## [1.5.15] - 2026-04-17

### ✨ Features
- **Monologue 2**: `gemini-3.1-flash-tts-preview` モデルがテキストを出力できない仕様に対応するため、ご提案いただいた「構成変更」を実装しました。
  1. STT で日本語を取得。
  2. 高速なテキストモデル（`gemini-3.1-flash-lite-preview` など）で英語に翻訳し、即座に画面へテキスト出力。
  3. その翻訳された英語テキストを `gemini-3.1-flash-tts-preview` へ改めて渡し、音声出力（TTS）させる、という「2段階RESTリクエスト構成」へと処理フローを作り直しました。
  これにより、翻訳テキストが確実に欠損なく表示されるようになります！

## [1.5.14] - 2026-04-17

### 🐛 Bug Fixes
- **Monologue 2**: `gemini-3.1-flash-tts-preview` モデル使用時、英語テキストが画面に出力されない問題に対処するため、Geminiへのシステムプロンプトに「必ずテキスト出力を併記すること」という強い指示を追加しました。
  - もしモデルの仕様制限により強制的に音声のみが返却された場合でも、その旨が `[ 音声のみ返却されました (テキストデータ無し) ]` として内部ログに表示されるようにエラーハンドリングを強化しました。

## [1.5.13] - 2026-04-17

### 🐛 Bug Fixes
- **Code Quality**: `MonologueREST.tsx` 内で不要な `any` キャストを使用していた箇所や、いくつかの空のブロック文および React Hook 依存関係に関する TypeScript / ESLint の警告・エラーを全て解消しました。

## [1.5.12] - 2026-04-17

### ✨ Features
- **Monologue 2**: Gemini APIへのリクエストパラメータ（`responseModalities`）に `"TEXT"` と `"AUDIO"` の両方を含めるよう修正しました。これにより、音声応答に加えて翻訳後の英語テキストも正しく生成され、コンソールのUI上にログとして表示されるようになります。

## [1.5.11] - 2026-04-17

### 🐛 Bug Fixes
- **Monologue 2**: Gemini APIからの音声応答が終了した後、自動的に次の「聞き取り（STT）」に移行せず、1回の発話で止まってしまっていたトランシーバーモードの仕様不具合を改修しました。現在は、応答が終わり次第シームレスに次の入力受付へとループします。

## [1.5.10] - 2026-04-17

### 🐛 Bug Fixes
- **Code Quality**: `MonologueREST.tsx` 内で、未使用の変数 `e` が存在し、空のブロック文（Empty block statement）が含まれていたことによる TypeScript / ESLint のビルドエラーを修正しました。

## [1.5.9] - 2026-04-17

### ✨ Features
- **Monologue 2 (REST Pipeline)**: WebSocket 等のストリーミング双方向通信を使わず、ブラウザ標準の音声認識機能（WebkitSpeechRecognition）と Gemini REST API を逐次利用する「完全に安定したパイプライン版」として実装を完全に刷新しました。
  - マイクトラブルやBluetooth接続由来のシステム遅延を受けにくくなり、単発での TTS (Text-to-Speech) 品質を検証しやすくなりました。
  - 翻訳中の `PROCESSING...` 状態を視覚化し、より確実なレスポンスが期待できます。

## [1.5.8] - 2026-04-17

### ✨ Features
- **Monologue 2 (Preview)**: 応答速度やTTS（Text-to-Speech）の品質比較・検証のため、試験モデルである `gemini-3.1-flash-tts-preview` を使用して動作する「MONOLOGUE 2」モードをヘッダーメニューに新設しました。既存のMONOLOGUE機能はそのまま利用可能です。

## [1.5.7] - 2026-04-17

### ✨ Features
- **Background Keep-Alive**: スマホの画面がロックされた状態でも、WebAudio APIのサイレント機能を利用してバックグラウンドでマイク録音・WebSocket通信を持続させる仕組みを導入しました。

### 💄 UI/UX Improvements
- **Terminal Log**: Monologue モードでの翻訳生成テキストのレイアウトを見直し、四角い見出しスタイルなどを廃止しました。システムの通知は控えめに、Geminiの翻訳テキストは大きくクリーンに表示するように改善しました。

## [1.5.6] - 2026-04-17

### 🐛 Bug Fixes
- **Bluetooth Headset Support**: Bluetoothイヤホンで接続した際にマイクの音声が拾えなかったり、大きなタイムラグ（遅延）が発生する問題を修正しました。
  - OSやブラウザの強制サンプリングによる遅延を回避するため、入力ソースのレートをハードウェアネイティブに任せ、アプリ内部で高速なソフトウェア・ダウンサンプリング（16kHz化）を行うよう録音処理を拡張しました。

## [1.5.5] - 2026-04-17

### 🐛 Bug Fixes
- **Audio Quality**: Monologue モードにおける音声の音質（ブチブチと途切れたりノイズが乗る現象）を大幅に改善しました。
  - 再生専用の `AudioContext` を録音用と分離し、ブラウザ本来の高音質レートで再生されるようにしました。
  - ネットワークの遅延を吸収し滑らかに再生が繋がるように 100ms のジッターバッファ（遅延余裕）を再生キューに導入しました。

## [1.5.4] - 2026-04-17

### 💄 UI/UX Improvements
- **Monologue Mode (Prompt)**: よりリスニングしやすいように、Geminiが少しゆっくりと英語をしゃべるようにシステムプロンプトを調整しました。
- **Monologue Mode (UI)**: マイク録音中であることが視覚的に分かりやすいよう、「RECORDING...」というインジケータ（録音ランプ）を追加し、ボタンの文言も分かりやすく整理しました。

## [1.5.3] - 2026-04-17

### 💄 UI/UX Improvements
- **Header**: アプリ左上のロゴの横に、現在のバージョン番号（`package.json` 準拠）を表示するようにしました。

## [1.5.2] - 2026-04-17

### 🐛 Bug Fixes
- **Audio Playback**: Gemini Live APIからの音声出力がスロー再生（低ピッチ）になってしまう問題を修正しました。（出力側のPCMが `24kHz` であることを正しくパースして再生バッファに適用するように改善しました）

## [1.5.1] - 2026-04-17

### 💄 UI/UX Improvements
- **Monologue Mode**: UIのサブタイトルからモデルのバージョン表記を削減し、「Powered by Gemini」というシンプルな表示へ微修正しました。

## [1.5.0] - 2026-04-17

### ✨ Features
- **Monologue Mode**: 追加！Gemini Multimodal Live API (`gemini-2.5-flash-native-audio-preview`等) を使用した、完全リアルタイムの双方向・音声翻訳（日本語→英語）モードを実装。メニュー名は「Monologue」としています。
- **Native PCM WebSocket**: APIの仕様に従い、マイク入力を内部で `16kHz PCM` にリアルタイム変換し、WebSocketを通じてGeminiと連続的な音声データの送受信を行う機能を構築。
- **Clear Voice**: Geminiの出力音声を、よりクリアな女性の声（"Kore" ボイス）に変更しました。

## [1.4.1] - 2026-04-17

### 💄 UI/UX Improvements
- **Navigation**: ヘッダーのメニューの並び順を `Shadowing` → `Coaching` → `Flashcards` の順に変更しました。
- **Settings**: Settings画面内の表示順を見直し、`Google Client ID` の設定項目を一番下に移動しました。

## [1.4.0] - 2026-04-17

### ✨ Features
- **Settings**: Geminiの使用モデルをSettings画面から自由に設定できるようになりました（デフォルト: `gemini-3.1-flash-lite-preview`, `gemini-3.1-pro-preview` などの最新モデルも選択可能）(Resolves #9)

## [1.3.0] - 2026-04-17

### 🔒 Security
- **SECURITY.md**: 脆弱性情報の報告手順やサポート対象バージョンを一覧で確認できるよう `SECURITY.md` を追加しました (Resolves #8)

### 📦 Dependencies
- **npm deps**: Dependabot による自動アップグレードPRをまとめてマージし、依存パッケージ（`react@19.2.5`, `react-dom@19.2.5`, `vite@8.0.8`, `lucide-react@1.8.0`, `typescript-eslint@8.58.2`）を更新しました。

## [1.2.2] - 2026-04-12

### 💄 UI/UX Improvements
- **Shadowing**: `REPEAT` および `SPD` セレクトボックスの右側に空いていた余分な余白（padding）を削除し、テキストが他ボタンと同様に中央揃えになるようデザインを統一しました。

## [1.2.1] - 2026-04-12

### ✨ Features
- **Lesson Coaching**: 分析結果（LOG）を日付入りのマークダウンファイル（`yuknow_coaching_YYYY-MM-DD.md`）としてダウンロード・保存できる「EXPORT」機能を追加。

## [1.2.0] - 2026-04-12

### ✨ Features
- **Lesson Coaching**: オンライン英会話レッスンの振り返りに特化した新メニュー「Coaching」を追加 (Fixes #5)
  - 録音したオンライン英会話の音声ファイル（MP3等、最大20MB）をアップロードし、Geminiに生徒側の発言のみにフォーカスして分析させる機能を実装。
  - プロンプトをカスタマイズし、「今日の総評」「良かった点」「改善点」「不自然だった表現とその修正案」「そのまま使える言い換え例」といった実践的なフィードバックをハッカー風UIで表示するようにしました。

## [1.1.1] - 2026-04-12

### 🐛 Bug Fixes
- **Shadowing**: マイクでの録音開始時に、再生中の音声品質が劣化し、スマホが「通話モード」になってしまう問題を解消 (Fixes #6)
  - ブラウザ標準のハードウェア・エコーキャンセル処理 (`echoCancellation: true`) が Bluetoothイヤホン等を強制的に低音質モード（HFP仕様）に切り替えてしまう現象を回避するため、マイク取得時の各種DSP処理を無効化する修正を行いました。

### ♻️ Refactoring (機能統合)
- **Shadowing**: 「TRACK Repeat（トラック全体ループ）」機能と「目標ループ回数表示」を一つのセレクトボックスに統合。
  - 単純な1回再生（OFF）、無限ループ（INF）、指定回数ループ（5, 10, 20...）などを1箇所で一元管理できるように改修。
  - 重複していたトラックリピート専用ボタンを削除し、UIをより直感的に操作できるようにシンプル化。

## [1.1.0] - 2026-04-12

### ✨ Features
- **Shadowing**: 目標ループ回数の設定とカウントダウン機能を追加 (Fixes #3)
  - シャドーイングの反復練習用に「指定回数（5/10/20/30回）ループすると自動停止する」機能を追加。
  - 残りループ回数を表示するリアルタイムインジケーターをコントロールパネルに設置。
  - A-B間リピート、およびトラック全体リピートの両方に対応。

### 🐛 Bug Fixes & Refactoring
- **Shadowing**: 選択したオーディオファイルがページリロード後に失われる問題を修正 (Fixes #2)
  - `idb-keyval` を利用し、読み込んだ音声ファイル自体をブラウザのローカルデータベース (IndexedDB) に自動キャッシュ。
  - 次回アクセス時やリロード時に、アップロード済みファイルを自動で復元再開する機能を実装。

## [1.0.0] - 2026-04-11

### ✨ Features (新機能・大規模な更新)

**[Flashcards] Google Docs からの自動単語帳生成機能**
- `Google OAuth 2.0` を用いたログイン機能を実装し、非公開のGoogle Docsから安全にノートを読み込み可能に。
- `Gemini 3.1 Flash Lite` を用いて、テキストから自動的に「英熟語・単語」と「意味」のペアを抽出する構造化抽出機能を実装。
- 間隔反復（Spaced Repetition）アルゴリズムに基づいたクイズ機能を実装し、学習記録を IndexedDB に永続化。

**[Shadowing] ハッカー風 UI を備えた AI 直接評価付きメディアプレイヤー**
- ローカルのMP3ファイルを独自プレイヤーで再生し、A-B間リピート機能・複数段階の再生速度調整（0.75x 〜 1.25x）を実装。
- **Auto Rec（自動録音）機能**: Web Audio API と `MediaRecorder` を用いて、再生と同時に自身の声を一時保存するマイク制御機能を実装。
- **Gemini EVALUATE機能**: お手本音声トラックから「自身が録音していた区間」だけをミリ秒単位で完全にオフラインレンダリング（WAV抽出）し、自身で録音した音声と同時にGeminiに送信。「100点満点での採点」「リズム・イントネーションの違い」「修正すべき箇所」のフィードバックと「自動文字起こし（TRANSCRIBE）」を実装。

**[UI / UX] デザインの全画面統一・最適化**
- アプリ全体のテーマを `ShadowTerm Edition`（ハッカー風テイスト: 漆黒背景、ネオングリーン文字、Fira Code等のプログラミングフォント）に統一。
- すべてのアイコンボタンに黒緑のホバーフリッカーエフェクトを追加。
- スマートフォンの狭い横幅でも美しく操作できるよう、CSSの `clamp` 関数を用いて余白（padding/margin）を手作業で徹底的に縮小。
- **Screen Wake Lock 機能**: Shadowingの再生中、ブラウザの画面が自動で暗くなったりスリープに入らないようにするOS連動ロック機能を実装。

### 🔧 Chores (その他の更新)
- プロジェクト（およびGitHubリポジトリ）の名称を `uKnow` から `yuKnow` に正式に変更。（関連する全ドメイン表記の修正完了）
- 汎用性の高い取扱説明書（`README.md`）の作成と、アプリ画面右端の `[Help]` パネルからのリアルタイム埋め込み読み込みの実装完了。
- バージョンと Changelog 更新を半自動化する npm リリーススクリプト (`npm run release:patch` など) の追加。

---

*※ これより過去の開発履歴は割愛されています。このファイルは以降、アップデートのたびにAIエージェント（Antigravity）によって自動生成・追記されます。*
