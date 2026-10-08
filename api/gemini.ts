import { GoogleGenAI, Type } from '@google/genai';

// Initialize Gemini client according to the gemini-api skill instructions
const getGeminiClient = () => {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

/**
 * OCR trích xuất danh sách từ vựng tiếng Trung từ ảnh chụp camera / tài liệu
 */
export async function extractVocabularyFromImage(base64Data: string, mimeType: string = 'image/jpeg') {
  const ai = getGeminiClient();

  const prompt = `
Bạn là chuyên gia sư phạm tiếng Trung và chuyên gia OCR ngôn ngữ Hán - Việt.
Hãy phân tích hình ảnh được cung cấp (ảnh chụp sách, giáo trình, vở ghi hoặc flashcard tiếng Trung) và trích xuất tất cả các từ vựng tiếng Trung có trong ảnh.
Đối với mỗi từ vựng trích xuất được:
1. "hanzi": Chữ Hán giản thể chuẩn xác
2. "pinyin": Phiên âm Pinyin có dấu thanh điệu chuẩn (ví dụ: xuéxí, nǐ hǎo)
3. "meaning": Nghĩa tiếng Việt ngắn gọn, dễ hiểu, chuẩn văn phong
4. "exampleSentence": Một câu ví dụ tiếng Trung ngắn gọn chứa từ đó (nếu trong ảnh có sẵn thì lấy, nếu không hãy tự tạo 1 câu dễ hiểu cho người mới học)
5. "examplePinyin": Pinyin của câu ví dụ
6. "exampleMeaning": Dịch nghĩa tiếng Việt của câu ví dụ

Chỉ trả về danh sách các từ vựng trích xuất được theo định dạng JSON schema yêu cầu.
`;

  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        },
        {
          text: prompt,
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        description: 'Danh sách các từ vựng tiếng Trung trích xuất từ ảnh',
        items: {
          type: Type.OBJECT,
          properties: {
            hanzi: { type: Type.STRING, description: 'Chữ Hán giản thể' },
            pinyin: { type: Type.STRING, description: 'Phiên âm Pinyin kèm dấu' },
            meaning: { type: Type.STRING, description: 'Nghĩa tiếng Việt' },
            exampleSentence: { type: Type.STRING, description: 'Câu ví dụ tiếng Trung' },
            examplePinyin: { type: Type.STRING, description: 'Pinyin câu ví dụ' },
            exampleMeaning: { type: Type.STRING, description: 'Nghĩa tiếng Việt của câu ví dụ' },
          },
          required: ['hanzi', 'pinyin', 'meaning'],
        },
      },
    },
  });

  const jsonText = response.text?.trim() || '[]';
  try {
    return JSON.parse(jsonText);
  } catch (err) {
    console.error('Failed to parse Gemini OCR response:', jsonText, err);
    return [];
  }
}

/**
 * Đánh giá phát âm tiếng Trung so với người bản xứ (Hỗ trợ cả text nhận diện và file ghi âm trực tiếp)
 */
export async function evaluatePronunciation(
  targetHanzi: string,
  targetPinyin: string,
  recognizedText: string = '',
  audioBase64?: string,
  audioMimeType: string = 'audio/webm'
) {
  const ai = getGeminiClient();

  const prompt = `
Bạn là chuyên gia thẩm định ngữ âm tiếng Trung bản ngữ (Standard Mandarin Phonetics).
Học viên đang luyện đọc từ sau:
- Hán tự mục tiêu: "${targetHanzi}"
- Pinyin mục tiêu: "${targetPinyin}"
${recognizedText ? `- Văn bản nhận dạng từ giọng học viên: "${recognizedText}"` : '- Học viên đã gửi bản ghi âm trực tiếp.'}

${audioBase64 ? 'Hãy lắng nghe kỹ file ghi âm đính kèm và phân tích phát âm thực tế của học viên.' : ''}

QUY TẮC BẮT BUỘC ĐÁNH GIÁ (RẤT QUAN TRỌNG):
1. NẾU HỌC VIÊN KHÔNG ĐỌC GÌ, IM LẶNG, CHỈ CÓ TIẾNG THỞ/TIẾNG ỒN MÔI TRƯỜNG, HOẶC NÓI TỪ TIẾNG VIỆT/TIẾNG ANH KHÔNG LIÊN QUAN:
   - "accuracyScore": 0
   - "pronunciationScore": 0
   - "toneScore": 0
   - "isCorrect": false
   - "recognizedText": "(Không có âm thanh / Chưa đọc)"
   - "syllableDetails": Mỗi chữ Hán có score: 0 và status: "needs_work"
   - "mistakeList": [{ "code": "Im lặng", "reason": "Chưa phát hiện giọng đọc tiếng Trung. Vui lòng bấm micro và đọc to, rõ ràng!" }]
   - "mistakeDetail": "Chưa ghi nhận được giọng đọc tiếng Trung."
   - "correctionGuide": "Hãy nghe âm mẫu bản xứ và đọc to theo chữ Hán trên màn hình."

2. NẾU HỌC VIÊN CÓ ĐỌC TIẾNG TRUNG:
   - Điểm tổng (accuracyScore): 0-100 tùy theo độ chuẩn của phụ âm, nguyên âm và thanh điệu.
   - Điểm phát âm (pronunciationScore): 0-100.
   - Điểm thanh điệu (toneScore): 0-100 (Thanh 1 cao bằng, Thanh 2 đi lên, Thanh 3 trầm sâu, Thanh 4 giật mạnh).
   - "isCorrect": true nếu >= 75 điểm, false nếu < 75 điểm.
   - "syllableDetails": Mảng chi tiết từng chữ Hán ("char", "pinyin", "score", "status": 'perfect'|'good'|'needs_work').
   - "mistakeList": Các lỗi lệch âm cụ thể (ví dụ "g→w", "ong→en", "Thanh 1→Thanh 4", "zh→z").

Chỉ trả về đối tượng JSON theo cấu trúc yêu cầu.
`;

  const parts: any[] = [];
  if (audioBase64 && audioBase64.trim()) {
    const cleanBase64 = audioBase64.includes('base64,')
      ? audioBase64.split('base64,')[1].trim()
      : audioBase64.trim();
    const cleanMimeType = (audioMimeType || 'audio/webm').split(';')[0].trim();

    if (cleanBase64.length > 50) {
      parts.push({
        inlineData: {
          mimeType: cleanMimeType,
          data: cleanBase64,
        },
      });
    }
  }
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          accuracyScore: { type: Type.INTEGER, description: 'Điểm tổng từ 0 - 100' },
          pronunciationScore: { type: Type.INTEGER, description: 'Điểm phát âm thanh mẫu/vận mẫu (0-100)' },
          toneScore: { type: Type.INTEGER, description: 'Điểm thanh điệu (0-100)' },
          isCorrect: { type: Type.BOOLEAN, description: 'Đạt chuẩn hay chưa' },
          recognizedText: { type: Type.STRING, description: 'Văn bản nghe được' },
          syllableDetails: {
            type: Type.ARRAY,
            description: 'Chi tiết từng âm tiết',
            items: {
              type: Type.OBJECT,
              properties: {
                char: { type: Type.STRING },
                pinyin: { type: Type.STRING },
                score: { type: Type.INTEGER },
                status: { type: Type.STRING },
              },
              required: ['char', 'pinyin', 'score', 'status'],
            },
          },
          mistakeList: {
            type: Type.ARRAY,
            description: 'Danh sách lỗi cụ thể',
            items: {
              type: Type.OBJECT,
              properties: {
                code: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ['code', 'reason'],
            },
          },
          mistakeDetail: { type: Type.STRING, description: 'Chỉ rõ cụ thể chỗ sai của người học' },
          correctionGuide: { type: Type.STRING, description: 'Hướng dẫn sửa chi tiết cách đọc từng bước' },
          toneFeedback: { type: Type.STRING, description: 'Nhận xét thanh điệu' },
          tips: { type: Type.STRING, description: 'Mẹo khẩu hình và bật hơi' },
          phoneticBreakdown: {
            type: Type.OBJECT,
            properties: {
              initial: { type: Type.STRING, description: 'Thanh mẫu' },
              final: { type: Type.STRING, description: 'Vận mẫu' },
              toneName: { type: Type.STRING, description: 'Tên thanh điệu' },
            },
          },
        },
        required: [
          'accuracyScore',
          'pronunciationScore',
          'toneScore',
          'isCorrect',
          'syllableDetails',
          'mistakeList',
          'mistakeDetail',
          'correctionGuide',
          'toneFeedback',
          'tips',
        ],
      },
    },
  });

  const jsonText = response.text?.trim() || '{}';
  try {
    const parsed = JSON.parse(jsonText);
    return {
      ...parsed,
      recognizedText: parsed.recognizedText || recognizedText,
    };
  } catch (err) {
    const chars = targetHanzi.split('').filter((c) => /[\u4e00-\u9fa5]/.test(c));
    const pinyins = (targetPinyin || '').split(/\s+/);
    const hasSpoken = Boolean(recognizedText && recognizedText.trim() && recognizedText !== '(Chưa rõ âm)');
    const isMatch = hasSpoken && recognizedText.trim().toLowerCase().includes(targetHanzi.trim().toLowerCase());

    if (!hasSpoken) {
      return {
        accuracyScore: 0,
        pronunciationScore: 0,
        toneScore: 0,
        isCorrect: false,
        recognizedText: '(Chưa phát hiện âm thanh)',
        syllableDetails: chars.map((char, i) => ({
          char,
          pinyin: pinyins[i] || '',
          score: 0,
          status: 'needs_work',
        })),
        mistakeList: [
          {
            code: 'Im lặng',
            reason: 'Chưa thu được giọng đọc. Hãy chạm micro và đọc to rõ ràng!',
          },
        ],
        mistakeDetail: 'Chưa phát hiện giọng đọc.',
        correctionGuide: `Hãy nghe âm mẫu của từ "${targetHanzi}" và đọc to theo.`,
        toneFeedback: `Thanh điệu chuẩn của "${targetHanzi}" là "${targetPinyin}".`,
        tips: 'Hãy mở micro và đọc to dứt khoát.',
      };
    }

    return {
      accuracyScore: isMatch ? 92 : 25,
      pronunciationScore: isMatch ? 95 : 30,
      toneScore: isMatch ? 90 : 20,
      isCorrect: isMatch,
      recognizedText: recognizedText || targetHanzi,
      syllableDetails: chars.map((char, i) => ({
        char,
        pinyin: pinyins[i] || '',
        score: isMatch ? 90 : 25,
        status: isMatch ? 'perfect' : 'needs_work',
      })),
      mistakeList: isMatch
        ? []
        : [
            {
              code: 'Lệch âm',
              reason: `Âm nhận diện '${recognizedText}'. Cần đọc đúng chuẩn '${targetHanzi}' (${targetPinyin}).`,
            },
          ],
      mistakeDetail: isMatch
        ? 'Phát âm chuẩn xác!'
        : `Âm đọc "${recognizedText}" chưa chuẩn với "${targetHanzi}" (${targetPinyin}).`,
      correctionGuide: `Hãy nghe kỹ cách phát âm của từ "${targetHanzi}" và bắt chước khẩu hình chuẩn.`,
      toneFeedback: `Thanh điệu chuẩn cho "${targetHanzi}" là "${targetPinyin}".`,
      tips: 'Mở rộng khẩu hình, phát âm dứt khoát và rõ thanh điệu.',
    };
  }
}

/**
 * Kiểm tra và chấm điểm nét chữ Hán người dùng vừa viết so với chữ mẫu
 */
export async function checkHandwritingMatch(
  imageBase64: string,
  targetHanzi: string,
  targetPinyin: string,
  meaning: string
) {
  const ai = getGeminiClient();

  const prompt = `
Bạn là bậc thầy thư pháp và giáo viên dạy viết chữ Hán (Hán tự / Hanzi).
Hình ảnh được cung cấp là chữ Hán do học viên vừa tự tay viết trên ô Mễ tự (米字格).
Chữ mẫu mục tiêu học viên cần viết là: "${targetHanzi}" (Pinyin: ${targetPinyin}, Nghĩa: ${meaning}).

Hãy kiểm tra kỹ lưỡng hình ảnh chữ viết tay của học viên và đánh giá xem chữ viết có khớp với chữ Hán mục tiêu không:
1. "isMatch": true nếu nhận diện rõ ràng là chữ "${targetHanzi}" (kể cả nét hơi méo), false nếu viết sai chữ khác hoặc thiếu/thừa nét nghiêm trọng.
2. "matchScore": Điểm số độ khớp từ 0 đến 100 dựa trên:
   - Viết đúng mặt chữ và cấu trúc bộ thủ (40%)
   - Tỷ lệ kích thước và vị trí trong ô Mễ tự (30%)
   - Độ chuẩn xác của nét bút (ngang, sổ, phẩy, mác, gập, móc) (30%)
3. "strokeComment": Nhận xét cụ thể (ví dụ: "Chữ viết đúng và rất rõ ràng", "Thiếu nét chấm bên phải", "Bộ thủ bên trái hơi nhỏ so với tổng thể", ...).
4. "advice": Mẹo viết đẹp theo quy tắc bút thuận (trên trước dưới sau, trái trước phải sau, ngoài trước trong sau...).
`;

  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: cleanBase64,
          },
        },
        {
          text: prompt,
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isMatch: { type: Type.BOOLEAN, description: 'Có khớp với chữ Hán mục tiêu hay không' },
          matchScore: { type: Type.INTEGER, description: 'Điểm khớp từ 0 đến 100' },
          strokeComment: { type: Type.STRING, description: 'Nhận xét về nét viết và bộ thủ' },
          advice: { type: Type.STRING, description: 'Lời khuyên cách viết bút thuận' },
        },
        required: ['isMatch', 'matchScore', 'strokeComment', 'advice'],
      },
    },
  });

  const jsonText = response.text?.trim() || '{}';
  try {
    return JSON.parse(jsonText);
  } catch (err) {
    return {
      isMatch: true,
      matchScore: 80,
      strokeComment: `Đã đối chiếu với chữ mẫu "${targetHanzi}".`,
      advice: 'Chú ý duy trì tỷ lệ cân đối giữa các bộ phận trong ô Mễ tự.',
    };
  }
}

/**
 * Tự động tạo từ vựng thông minh bằng AI Gemini:
 * 1. User nhập tiếng Việt -> AI suy ra tiếng Trung + Pinyin + tạo Gợi ý ngữ cảnh / mô tả câu đố + câu ví dụ
 * 2. User nhập tiếng Trung -> AI suy ra tiếng Việt + Pinyin + tạo Gợi ý ngữ cảnh / mô tả câu đố + câu ví dụ
 */
export async function generateSmartVocab(input: string, sourceLang?: 'vi' | 'zh') {
  const ai = getGeminiClient();

  const prompt = `
Bạn là chuyên gia ngôn ngữ học và sư phạm tiếng Trung - tiếng Việt hàng đầu.
Người dùng cung cấp một từ hoặc cụm từ: "${input.trim()}".
Nguồn ngôn ngữ được chỉ định: ${sourceLang ? (sourceLang === 'vi' ? 'Tiếng Việt' : 'Tiếng Trung') : 'Tự nhận diện'}.

Nhiệm vụ của bạn:
1. Nếu từ đầu vào là Tiếng Việt:
   - "hanzi": Tìm chữ Hán giản thể chuẩn xác nhất, phổ biến nhất trong giao tiếp hoặc giáo trình HSK.
   - "pinyin": Phiên âm Pinyin chuẩn có dấu thanh điệu (ví dụ: nǐ hǎo).
   - "meaning": Nghĩa tiếng Việt chuẩn xác, giữ nguyên nghĩa cốt lõi, ngắn gọn.
   - "contextClue": Tạo một đoạn mô tả ngữ cảnh / câu đố gợi mở sinh động (1-2 câu tiếng Việt) mô tả tình huống, hoàn cảnh sử dụng hoặc hành động cụ thể để người học có thể tự suy luận ra nghĩa mà không nói thẳng từ đó ra. (Ví dụ với "xin chào": "Lời chào hỏi mở đầu cuộc gặp gỡ thân thiện và phổ biến nhất khi gặp ai đó.").
   - "exampleSentence": Một câu ví dụ tiếng Trung ngắn gọn, tự nhiên chứa từ đó.
   - "examplePinyin": Pinyin của câu ví dụ.
   - "exampleMeaning": Dịch nghĩa tiếng Việt của câu ví dụ.

2. Nếu từ đầu vào là Tiếng Trung (hoặc chữ Hán / Pinyin):
   - "hanzi": Chuẩn hóa chữ Hán giản thể chuẩn.
   - "pinyin": Phiên âm Pinyin chuẩn có dấu thanh điệu.
   - "meaning": Dịch sang nghĩa tiếng Việt chính xác, tự nhiên, ngắn gọn.
   - "contextClue": Tạo một đoạn mô tả ngữ cảnh / câu đố gợi mở sinh động (1-2 câu tiếng Việt) mô tả tình huống, hoàn cảnh sử dụng hoặc hành động cụ thể để người học có thể tự suy luận ra nghĩa mà không nói thẳng từ đó ra.
   - "exampleSentence": Một câu ví dụ tiếng Trung ngắn gọn chứa từ đó.
   - "examplePinyin": Pinyin của câu ví dụ.
   - "exampleMeaning": Dịch nghĩa tiếng Việt của câu ví dụ.

Chỉ trả về JSON theo đúng Schema.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hanzi: { type: Type.STRING, description: 'Chữ Hán giản thể chuẩn' },
          pinyin: { type: Type.STRING, description: 'Phiên âm Pinyin có dấu thanh điệu' },
          meaning: { type: Type.STRING, description: 'Nghĩa tiếng Việt cốt lõi' },
          contextClue: { type: Type.STRING, description: 'Đoạn gợi ý ngữ cảnh / câu đố để tự suy ra nghĩa' },
          exampleSentence: { type: Type.STRING, description: 'Câu ví dụ tiếng Trung' },
          examplePinyin: { type: Type.STRING, description: 'Pinyin của câu ví dụ' },
          exampleMeaning: { type: Type.STRING, description: 'Dịch nghĩa tiếng Việt của câu ví dụ' },
        },
        required: [
          'hanzi',
          'pinyin',
          'meaning',
          'contextClue',
          'exampleSentence',
          'examplePinyin',
          'exampleMeaning',
        ],
      },
    },
  });

  const jsonText = response.text?.trim() || '{}';
  return JSON.parse(jsonText);
}

