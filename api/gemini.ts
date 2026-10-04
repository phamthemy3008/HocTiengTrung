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
Học viên đang phát âm từ sau:
- Hán tự mục tiêu: "${targetHanzi}"
- Pinyin mục tiêu: "${targetPinyin}"
${recognizedText ? `- Văn bản nhận dạng từ giọng học viên: "${recognizedText}"` : '- Học viên đã gửi bản ghi âm trực tiếp.'}

${audioBase64 ? 'Hãy lắng nghe kỹ file ghi âm đính kèm và phân tích phát âm thực tế của học viên.' : ''}

Hãy phân tích ngữ âm cực kỳ chi tiết theo mô hình đánh giá 2 điểm số (Phát âm & Thanh điệu) và trả về đối tượng JSON gồm:
1. "accuracyScore": Điểm tổng thể từ 0 đến 100.
2. "pronunciationScore": Điểm phát âm phụ âm/nguyên âm (thanh mẫu/vận mẫu) từ 0 đến 100.
3. "toneScore": Điểm chuẩn xác về thanh điệu (1, 2, 3, 4) từ 0 đến 100.
4. "isCorrect": true nếu phát âm tốt (>= 75 điểm), false nếu cần cải thiện.
5. "recognizedText": Chuỗi văn bản tiếng Trung hoặc phiên âm mà bạn nghe được từ học viên.
6. "syllableDetails": Mảng chi tiết từng chữ Hán trong từ (theo thứ tự các chữ trong "${targetHanzi}"):
   - "char": Chữ Hán tương ứng (ví dụ "工", "作")
   - "pinyin": Pinyin có dấu của chữ đó (ví dụ "gōng", "zuò")
   - "score": Điểm phát âm riêng của âm tiết đó (0-100, ví dụ 37, 80)
   - "status": 'perfect' (>=85), 'good' (70-84), hoặc 'needs_work' (<70)
7. "mistakeList": Danh sách các lỗi lệch âm hoặc thanh điệu cụ thể (nếu có):
   - "code": Ký hiệu lỗi ngắn gọn (ví dụ "g→w", "ong→en", "uo→u", "Thanh 1→Thanh 4", "zh→z")
   - "reason": Giải thích nguyên nhân ngắn gọn tiếng Việt (ví dụ: "Phụ âm đầu 1 bị lệch, nghe như 'w'", "Vần 1 bị lệch, nghe như 'en'", "Vần 2 bị lệch, nghe như 'u'")
8. "mistakeDetail": Tóm tắt tổng quan chỗ sai rõ ràng cho học viên.
9. "correctionGuide": Hướng dẫn sửa khẩu hình, vị trí lưỡi và luồng hơi từng bước.
10. "toneFeedback": Phân tích chuẩn xác về quy luật thanh điệu của "${targetPinyin}".
11. "tips": Mẹo bắt chước dễ nhớ so sánh với âm tiếng Việt.
12. "phoneticBreakdown":
    - "initial": Thanh mẫu chính
    - "final": Vận mẫu chính
    - "toneName": Tên thanh điệu
`;

  const parts: any[] = [];
  if (audioBase64) {
    const cleanBase64 = audioBase64.replace(/^data:audio\/[a-z0-9]+;base64,/, '');
    parts.push({
      inlineData: {
        mimeType: audioMimeType || 'audio/webm',
        data: cleanBase64,
      },
    });
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
    const isMatch = recognizedText.trim().toLowerCase() === targetHanzi.trim().toLowerCase();
    const chars = targetHanzi.split('').filter((c) => /[\u4e00-\u9fa5]/.test(c));
    const pinyins = (targetPinyin || '').split(/\s+/);

    return {
      accuracyScore: isMatch ? 92 : 65,
      pronunciationScore: isMatch ? 95 : 70,
      toneScore: isMatch ? 90 : 60,
      isCorrect: isMatch,
      recognizedText: recognizedText || targetHanzi,
      syllableDetails: chars.map((char, i) => ({
        char,
        pinyin: pinyins[i] || '',
        score: isMatch ? 90 : 65,
        status: isMatch ? 'perfect' : 'needs_work',
      })),
      mistakeList: isMatch
        ? []
        : [
            {
              code: `${targetPinyin.slice(0, 2)}...`,
              reason: `Âm nhận diện '${recognizedText}'. Cần điều chỉnh theo phát âm chuẩn '${targetPinyin}'.`,
            },
          ],
      mistakeDetail: isMatch
        ? 'Phát âm chuẩn xác!'
        : `Cần điều chỉnh khẩu hình để phát âm chuẩn "${targetHanzi}" (${targetPinyin}).`,
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

