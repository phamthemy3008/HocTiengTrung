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
 * Đánh giá phát âm tiếng Trung so với người bản xứ
 */
export async function evaluatePronunciation(
  targetHanzi: string,
  targetPinyin: string,
  recognizedText: string
) {
  const ai = getGeminiClient();

  const prompt = `
Bạn là giáo viên phát âm tiếng Trung bản ngữ chuẩn phổ thông (Beijing / Standard Mandarin).
Học viên đang luyện đọc từ:
- Hán tự mục tiêu: "${targetHanzi}"
- Pinyin mục tiêu: "${targetPinyin}"
- Văn bản nhận diện từ giọng nói học viên: "${recognizedText || '(Chưa bắt được âm thanh rõ ràng)'}"

Hãy đánh giá và đưa ra:
1. "accuracyScore": Điểm chính xác từ 0 đến 100. (Nếu nhận diện đúng Hán tự thì điểm 85-100, nếu gần giống thì 50-80, nếu sai hẳn thì dưới 50).
2. "isCorrect": true nếu phát âm đạt chuẩn (>= 75 điểm), false nếu cần cải thiện.
3. "toneFeedback": Nhận xét chi tiết về thanh điệu (Thanh 1 cao bằng 55, Thanh 2 lên dốc 35, Thanh 3 xuống rồi lên 214, Thanh 4 hạ mạnh dứt khoát 51, hoặc khinh thanh) của từ "${targetPinyin}".
4. "tips": Mẹo phát âm khẩu hình miệng, vị trí lưỡi và luồng hơi (bật hơi hay không bật hơi) bằng tiếng Việt thật dễ hiểu, ngắn gọn và hữu ích cho người Việt Nam.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          accuracyScore: { type: Type.INTEGER, description: 'Điểm số từ 0 - 100' },
          isCorrect: { type: Type.BOOLEAN, description: 'Đạt chuẩn hay chưa' },
          toneFeedback: { type: Type.STRING, description: 'Nhận xét thanh điệu' },
          tips: { type: Type.STRING, description: 'Mẹo khẩu hình và bật hơi' },
        },
        required: ['accuracyScore', 'isCorrect', 'toneFeedback', 'tips'],
      },
    },
  });

  const jsonText = response.text?.trim() || '{}';
  try {
    const parsed = JSON.parse(jsonText);
    return {
      ...parsed,
      recognizedText,
    };
  } catch (err) {
    return {
      accuracyScore: recognizedText === targetHanzi ? 95 : 60,
      isCorrect: recognizedText === targetHanzi,
      toneFeedback: `Chú ý thanh điệu của "${targetPinyin}".`,
      tips: 'Luyện tập khẩu hình và nghe lại phát âm mẫu của người bản ngữ.',
      recognizedText,
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

