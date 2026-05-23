import { GoogleGenerativeAI } from '@google/generative-ai';

export interface VocabItem {
  id: string; // generated unique id
  term: string;
  meaning: string;
  partOfSpeech: string;
  exampleSentence: string;
}

export async function parseVocabularyWithGemini(apiKey: string, text: string, modelName: string): Promise<VocabItem[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `
以下のテキストは英語学習のメモです。このテキストから、学習すべき「英単語」または「フレーズ」を抽出し、JSON形式の配列で出力してください。
各要素は以下のキーを持つオブジェクトにしてください。1回の抽出で10から50個の単語・フレーズを見つけてください（テキストが短い場合は見つかるだけで構いません）。

- term: 英単語またはフレーズ
- meaning: 日本語の意味
- partOfSpeech: 品詞（名詞、動詞など。フレーズの場合は"phrase"等）
- exampleSentence: その単語/フレーズを使った英語の例文（メモ内にあればそれを優先し、なければ自然な例文を生成してください）

JSONフォーマットのみを出力し、マークダウンのコードブロック (\`\`\`json など) は含めないでください。空の配列の場合は [] を出力してください。

[学習メモ]:
${text}
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let textResponse = response.text().trim();
  
  // Remove potential markdown fences
  if (textResponse.startsWith('\`\`\`')) {
    textResponse = textResponse.replace(/^\`\`\`json/i, '').replace(/^\`\`\`/, '');
    textResponse = textResponse.replace(/\`\`\`$/, '');
  }

  try {
    const parsed = JSON.parse(textResponse.trim());
    if (Array.isArray(parsed)) {
      return parsed.map(item => ({
        id: crypto.randomUUID(),
        term: item.term || '',
        meaning: item.meaning || '',
        partOfSpeech: item.partOfSpeech || '',
        exampleSentence: item.exampleSentence || ''
      }));
    }
    return [];
  } catch (e) {
    console.error("Gemini JSON parse error:", e, textResponse);
    throw new Error("Failed to parse AI response into vocabulary format.");
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = (reader.result as string).split(',')[1];
      resolve(base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudioWithGemini(apiKey: string, audioBlob: Blob, modelName: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const base64data = await blobToBase64(audioBlob);
  const mimeType = audioBlob.type || 'audio/mp4';

  const prompt = "Please transcribe the English speech in this audio precisely. Output only the transcribed text without extra commentary or markdown. If there is no audible speech, output nothing.";

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64data,
          mimeType: mimeType
        }
      },
      { text: prompt }
    ]);
    const response = await result.response;
    return response.text().trim();
  } catch (e) {
    console.error("Gemini Transcription error:", e);
    throw new Error("Failed to transcribe audio.");
  }
}

export async function evaluateShadowingWithGemini(apiKey: string, sourceBlob: Blob, recordedBlob: Blob, modelName: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const sourceBase64 = await blobToBase64(sourceBlob);
  const recordedBase64 = await blobToBase64(recordedBlob);

  const prompt = `
以下の2つの音声データを比較し、2つ目の音声（英語学習者のシャドーイング録音）を日本語で評価してください。
1番目の音声: ネイティブのお手本音声
2番目の音声: 学習者の録音音声

以下の形式で評価を出力してください。
SCORE: [100点満点中の点数]/100

[改善点 (IMPROVEMENTS)]
- 優先的に直すべき発音のミス（上手く発音できていなかった単語）を指摘してください。
- リズム感やイントネーションについても、違和感や直すべき部分があれば具体的に指摘してください。

トランスクリプト (TRANSCRIPT): [1番目の音声の文字起こしを英語で]
`;

  try {
    const result = await model.generateContent([
      {
        inlineData: { data: sourceBase64, mimeType: sourceBlob.type || 'audio/wav' }
      },
      {
        inlineData: { data: recordedBase64, mimeType: recordedBlob.type || 'audio/mp4' }
      },
      { text: prompt.trim() }
    ]);
    const response = await result.response;
    return response.text().trim();
  } catch (e) {
    console.error("Gemini Evaluation error:", e);
    throw new Error("Failed to evaluate audio.");
  }
}

export async function analyzeLessonAudioWithGemini(apiKey: string, audioBlob: Blob, modelName: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const base64data = await blobToBase64(audioBlob);
  const mimeType = audioBlob.type || 'audio/mp4';

  const prompt = `You are an English speaking coach analyzing my online English lesson.

I will provide an audio recording of my lesson.
Please analyze only my English output, not the teacher’s, unless comparison is helpful.

I want practical feedback that helps me improve for the next lesson.
Please respond in Japanese and use the following structure exactly (output plain text Markdown):

1. 今日の総評
- My overall speaking level in this lesson
- What I did well
- What held me back most

2. 良かった点
- 3 specific strengths from my speaking

3. 改善点
- 3 to 5 important weaknesses
- Focus on high-impact issues, not tiny mistakes

4. 不自然だった表現
For each item:
- My original sentence
- Why it sounds unnatural
- A more natural correction
- A simpler correction I can actually use in conversation

5. 詰まりやすかった場面の分析
- Where I hesitated or got stuck
- Why that happened
- What I should practice to fix it

6. 次回までの練習ポイント
- 3 concrete things to practice before the next lesson

7. そのまま使える言い換え例
- Give me 10 useful English phrases based on mistakes from this lesson

8. 復習用ミニまとめ
- A short summary I can reread in 1 minute

Important rules:
- Be specific and practical
- Prioritize fluency and natural speaking over perfect grammar
- Do not overwhelm me with too many corrections
- Focus on the most useful improvements`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64data,
          mimeType: mimeType
        }
      },
      { text: prompt }
    ]);
    const response = await result.response;
    return response.text().trim();
  } catch (e) {
    console.error("Gemini Lesson Analysis error:", e);
    throw new Error("Failed to analyze lesson audio.");
  }
}

export async function generateTopicScript(apiKey: string, modelName: string, topicTitle: string, rawNotesJa: string): Promise<{ outline: string, script: string }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const prompt = `あなたはプロの英語スピーキング・コーチです。
生徒が以下のトピックについて話すために書いた「日本語のメモ・壁打ち内容」から、整理された「構成案（日本語）」と、実践でそのまま使える「自然な口語調の英語スクリプト」を作成してください。

トピック: ${topicTitle}

生徒のメモ:
${rawNotesJa}

以下のJSON形式で出力してください。Markdownのコードブロックは不要です。
{
  "outline": "ここに日本語の構成案・話の展開のまとめ（数行の箇条書きなど）を入れる",
  "script": "ここに、堅苦しすぎない自然な会話会話の英語スクリプトを入れる"
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let textResponse = response.text().trim();
    if (textResponse.startsWith('\`\`\`')) {
      textResponse = textResponse.replace(/^\`\`\`json/i, '').replace(/^\`\`\`/, '');
      textResponse = textResponse.replace(/\`\`\`$/, '');
    }
    const parsed = JSON.parse(textResponse.trim());
    return {
      outline: parsed.outline || '',
      script: parsed.script || ''
    };
  } catch (e) {
    console.error("Gemini Script Generation error:", e);
    throw new Error("Failed to generate topic script.");
  }
}

export async function generateTopicFeedback(apiKey: string, modelName: string, topicTitle: string, userLogs: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const prompt = `You are a friendly English speaking coach.
I just practiced speaking about the topic: "${topicTitle}".
Here is the transcript of my practice session:

${userLogs}

Please provide practical feedback on my English performance. Respond in Japanese but use English for examples.
Please output plain text Markdown strictly using the following structure:

### 1. 総評
- 全体的な伝わりやすさや良かった点、改善できる方向性などの要約。

### 2. より自然な表現へのブラッシュアップ
- ピックアップした私の元の発言 : 修正案と、なぜそのように言うと自然なのかの解説。（3〜5個程度）

### 3. 次回使えるオススメフレーズ
- このトピックについて話す際によく使うネイティブの表現を3つ程度。`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (e) {
    console.error("Gemini Topic Feedback error:", e);
    throw new Error("Failed to generate practice feedback.");
  }
}

export async function generateReflexFeedback(apiKey: string, modelName: string, logs: string, currentLevel?: string, currentTheme?: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const prompt = `以下のトランスクリプトは、ユーザーが日本語の文を英語に翻訳し、スピーキング練習をした記録です。
現在の設定: レベル=${currentLevel || '不明'}, テーマ=${currentTheme || '総合・ランダム'}

このセッションの「総括フィードバック」を作成してください。
以下の要素を含めてください：
- 全体的な強み・良かった点
- 繰り返して間違えたポイントや文法の癖
- より自然にするためのフレーズ提案・語彙の改善案
- 次のステップへの具体的な提案
- **次に Reflex を訓練する際の「推奨レベル（CEFR: A1-C2）」と「推奨の文法テーマ」**（今回のパフォーマンスを基に判断してください）

簡潔かつ励ましになるようなポジティブな口調で、マークダウン形式で出力してください。

トランスクリプト:
${logs}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (e) {
    console.error("Gemini Reflex Feedback error:", e);
    throw new Error("Failed to generate reflex feedback.");
  }
}

export async function generateFreeTalkFeedback(apiKey: string, modelName: string, logs: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const prompt = `以下の会話ログは、ユーザーが英語のフリートーク練習をした記録です。
このセッションの「総括フィードバック」を作成してください。
以下の要素を含めてください：
- 全体的な強み・良かった点・コミュニケーションの姿勢
- さらに会話を自然に広げるためのアドバイス
- より自然にするためのフレーズ提案・語彙の改善案（ユーザーの発言をピックアップして修正）
簡潔かつ励ましになるようなポジティブな口調で、マークダウン形式で出力してください。

トランスクリプト:
${logs}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (e) {
    console.error("Gemini FreeTalk Feedback error:", e);
    throw new Error("Failed to generate free talk feedback.");
  }
}

export async function evaluatePhotoDescriptionWithGemini(apiKey: string, imageBlob: Blob, audioBlob: Blob, modelName: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const imageBase64 = await blobToBase64(imageBlob);
  const audioBase64 = await blobToBase64(audioBlob);

  const prompt = `You are an expert TOEIC Speaking test examiner and English coach.
I have provided a photo and an audio recording of my spoken description of this photo.

Please evaluate my photo description (TOEIC Speaking format, ~45 seconds).
Listen to my audio to evaluate my fluency, pronunciation, and content, and compare it against the provided photo.

Respond entirely in Japanese (but use English for examples and transcript). Please output plain text Markdown strictly using the following structure:

### 1. トランスクリプト (What you said)
- [Provide a precise transcription of my English speech]

### 2. 総括フィードバック (Overall Feedback)
- Did I organize the description logically? (e.g., general picture -> details -> background)
- Did I speak fluently with good pace?
- What were my strengths?

### 3. 要注意・改善ポイント (Areas for Improvement)
- 指摘すべき不自然な文法や単語のミス (Grammar/Vocab corrections)
- 「もっとこう言えばテストで高得点になる」という実践的なアドバイス
- 写真の重要な部分で、私が言いそびれていた情報があれば指摘

### 4. より自然な表現への修正 (Phrasing Corrections)
- [元の発言] -> [より自然でTOEICらしい表現] の形式で3箇所ほど修正案を提示してください。

### 5. 模範解答例 (Model Answer)
- Provide a clear, natural, and highly articulate model answer that a high-scoring test taker might say in 45 seconds. Keep it realistic for spoken English (about 5-7 sentences).`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: imageBlob.type || 'image/jpeg'
        }
      },
      {
        inlineData: {
          data: audioBase64,
          mimeType: audioBlob.type || 'audio/webm' // Or whatever recording format is chosen
        }
      },
      { text: prompt }
    ]);
    const response = await result.response;
    return response.text().trim();
  } catch (e) {
    console.error("Gemini Photo Description Evaluation error:", e);
    throw new Error("Failed to evaluate photo description.");
  }
}

export async function generateToeicImagePrompt(apiKey: string, modelName: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const prompt = `You are a creative director for an English language exam.
Please generate a single, highly detailed English prompt describing a photorealistic everyday scene that would be perfect for a TOEIC Speaking "Describe a Picture" task.
The scene should feature people doing regular activities (e.g., waiting at an airport, working in a modern office, shopping in a grocery store, eating at an outdoor cafe, attending a meeting, or construction workers on site).
Include details about the setting, lighting, people's actions, and objects around them.

Rules:
- Make it around 20 to 30 words.
- Output ONLY the prompt text, nothing else.
- Ensure the scene is completely random and different every time.
- Start directly with the description (e.g. "A photorealistic image of...").`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (e) {
    console.error("Gemini Image Prompt Generation error:", e);
    throw new Error("Failed to generate image prompt.");
  }
}

export async function generatePronunciationFeedback(apiKey: string, modelName: string, logs: string, theme: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const prompt = `以下のログは、ユーザーが英語の発音トレーニング（テーマ: ${theme}）を行った記録です。
このセッションの「総括フィードバック」を作成してください。
以下の要素を含めてください：
- 全体的な発音の明瞭さと、良かった点
- 今回のテーマ（${theme}）に関して、うまくできていたことと、まだ課題として残っていること
- 継続して練習すべき具体的な単語や音の指摘
- 次回の練習へのアドバイス

簡潔かつ励ましになるようなポジティブな口調で、マークダウン形式で出力してください。

トランスクリプト:
${logs}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (e) {
    console.error("Gemini Pronunciation Feedback error:", e);
    throw new Error("Failed to generate pronunciation feedback.");
  }
}
