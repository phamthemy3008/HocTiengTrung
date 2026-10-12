# Tích Hợp Chế Độ Luyện Gõ Pinyin (Pinyin Typing Mode & IME Simulator)

Kế hoạch bổ sung chế độ học mới: **Luyện Gõ Pinyin** vào Phiên học ôn tập (Study Session). Tính năng này giúp học viên biến kỹ năng nhận diện thụ động thành phản xạ gõ bàn phím chủ động — mô phỏng chính xác cách thức giao tiếp và làm việc thực tế bằng tiếng Trung trên máy tính và điện thoại thông minh.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Dựa trên phản hồi khảo sát của bạn, các quyết định cốt lõi đã được xác lập như sau:

- **Confirmed Decision 1 (Vị trí & Cơ chế)**: Tích hợp trực tiếp thành một Chế độ học chính song song trong `StudySession` (`pinyin_to_hanzi`) và bổ sung Sheet chuyên dụng (`Sheet 3: ⌨️ Luyện Gõ Pinyin`) trong khung thẻ hợp nhất.
- **Confirmed Decision 2 (Quy tắc nhận diện Pinyin)**: Hỗ trợ linh hoạt đa cơ chế (Fuzzy Pinyin): Chấp nhận Pinyin không dấu (`nihao`), Pinyin kèm số thanh điệu (`ni3hao3` hoặc `ni3 hao3`), và Pinyin chuẩn có dấu (`nǐ hǎo`).
- **Confirmed Decision 3 (Phản hồi & Trợ giúp)**: Tự động kiểm tra cú pháp ngay khi gõ; tích hợp thanh ứng viên chữ Hán mô phỏng bộ gõ IME (`[1. 你好  2. 拟好 ...]`) để người học rèn luyện nhận diện chữ Hán đúng giữa các từ đồng âm. Khi gõ đúng, hiển thị chữ Hán bung nở mượt mà, phát âm thanh bản xứ và ghi nhận tiến độ SRS.
- **Open Choice with Recommended Default (Bàn phím Mobile)**: Tích hợp hàng phím ký tự thanh điệu nhanh (`ā á ǎ à...`) ngay phía trên ô gõ để người học dùng điện thoại có thể bấm thanh điệu thuận tiện mà không cần cài thêm bàn phím tiếng Trung.

---

## 1. Overview & Core Concept

- **What It Does**: Cung cấp giao diện tương tác luyện gõ Pinyin. Khi thẻ xuất hiện, người học thấy Nghĩa tiếng Việt, Gợi ý ngữ cảnh (Context clue) và có thể bấm nghe âm thanh. Người học gõ Pinyin vào ô nhập liệu; hệ thống tự động chuẩn hóa, hiển thị danh sách ứng viên chữ Hán và chấm điểm tức thì.
- **Target Audience**: Học viên tiếng Trung mọi trình độ (HSK 1 đến nâng cao) có nhu cầu rèn luyện kỹ năng gõ phím nhắn tin WeChat, làm việc văn phòng và ghi nhớ chữ Hán qua bàn phím điện thoại/máy tính.
- **Key Value**: Chuyển đổi từ "nhìn mặt chữ thụ động" sang "phản xạ chủ động" (Active Recall). Giải quyết bài toán phổ biến: thuộc nghĩa nhưng không nhớ âm tiết chuẩn hoặc hay gõ nhầm chữ Hán khi dùng máy tính.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Khởi động phiên học**:
   - Trong thanh điều khiển `StudySession`, người học có thể chọn chế độ học `⌨️ Gõ Pinyin → Chữ Hán`, hoặc bấm chuyển nhanh sang tab `Sheet 3: ⌨️ Luyện Gõ Pinyin`.
2. **Hiển thị thẻ bài tập**:
   - **Mặt trước**: Hiển thị nghĩa tiếng Việt nổi bật, gợi ý ngữ cảnh/câu đố gợi mở, số lượng chữ Hán mục tiêu (ví dụ: `2 chữ Hán`).
   - Ô nhập liệu Pinyin được tự động `autoFocus` (trên máy tính) với con trỏ nhấp nháy sẵn sàng.
3. **Thao tác gõ**:
   - Người học gõ `nihao` hoặc `ni3hao3`.
   - Xuất hiện thanh ứng viên chữ Hán nổi bật mô phỏng bộ gõ IME phía trên ô gõ: `[ 1. 你好 (Mục tiêu)  |  2. 拟好  |  3. 泥壕 ]`.
   - Trên điện thoại: Có thanh phím phụ chứa nguyên âm có dấu `ā á ǎ à ...` và các phím số `1 2 3` để chạm nhanh.
4. **Kiểm tra & Hoàn thành**:
   - Bấm `Enter` hoặc chạm chọn số `1`:
     - **Nếu đúng**: Hiệu ứng viền xanh ngọc bích, pháo hoa mini (confetti), chữ Hán hiển thị to rõ kèm câu ví dụ, âm thanh phát âm bản xứ vang lên. Tự động chấm điểm SM-2 và đếm ngược chuyển sang từ tiếp theo sau 1 giây.
     - **Nếu sai**: Ô gõ rung nhẹ cảnh báo (shake animation), hiển thị lỗi lệch âm cụ thể (ví dụ: gõ `shei` thay vì `shui`), cho phép gõ lại hoặc bấm xem đáp án.

### Visual Identity & Theme (Frontend Design Alignment)

- **Color Palette & Discipline**:
  - Tuân thủ quy tắc 60-30-10: Canvas trắng sữa/stone nhạt (`#FDFBF7` / `#FAFAF9`), thẻ trung tâm bo cong mềm mại `rounded-3xl` với viền hairline `border-stone-200`.
  - Màu nhấn chính cho chế độ gõ Pinyin: Indigo / Deep Blue (`#3730A3` / `#4F46E5` hoặc `#B91C1C` theo hệ thống ấm áp của ứng dụng) phân biệt rõ với Luyện Viết (Amber/Nâu đỏ) và Luyện Đọc (Đỏ son).
- **Typography**:
  - Font hiển thị Pinyin: Monospace rõ ràng (`font-mono tracking-wider text-lg`) để học viên dễ quan sát từng phụ âm và thanh điệu.
  - Chữ Hán ứng viên: `font-serif` truyền thống hoặc `font-sans` tiếng Trung sắc nét.
- **Top Bar & Navigation Contract**:
  - Tích hợp thêm tab `Sheet 3: ⌨️ Luyện Gõ` trong cụm chuyển đổi Sheet hiện có (`p-1 bg-stone-100 rounded-2xl`), không làm vỡ bố cục một hàng trên màn hình rộng và co giãn mượt mà trên mobile.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Xử lý chuẩn hóa Pinyin (Pinyin Normalizer Engine)**
  - *Chosen Approach*: Xây dựng hàm tiện ích `normalizePinyinInput(input, targetPinyin)` thuần Client-side:
    1. Chuyển đổi Pinyin có dấu thành không dấu (loại bỏ dấu thanh điệu: `ǎ` $\to$ `a`).
    2. Chuyển đổi Pinyin dạng số (`ni3 hao3`) thành không dấu hoặc có dấu.
    3. So khớp không phân biệt hoa/thường, tự động bỏ khoảng trắng thừa.
  - *Why*: Tốc độ phản hồi 0ms ngay trên trình duyệt, không cần gửi request lên backend, hoạt động trơn tru cả khi Offline.
- **Decision 2: Mô phỏng bộ gõ IME (Candidate List Simulator)**
  - *Chosen Approach*: Sinh danh sách 3–5 chữ Hán ứng viên: Chữ Hán đúng luôn được đặt ngẫu nhiên ở vị trí 1–3, kèm các chữ Hán đồng âm (homophones) hoặc từ liên quan trong bộ từ vựng.
  - *Why*: Tái hiện chính xác cảm giác gõ phím thực tế, giúp học viên không bị bỡ ngỡ khi chuyển sang gõ trên Zalo/WeChat.
- **Decision 3: Trải nghiệm Mobile First cho Ô gõ**
  - *Chosen Approach*: Cấu hình ô input `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck="false"`, `inputMode="text"`, cùng thanh ký tự thanh điệu chạm nhanh.
  - *Why*: Tránh bàn phím điện thoại tự động viết hoa chữ cái đầu hoặc tự sửa lỗi từ tiếng Anh làm sai lệch Pinyin.

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          StudySession.tsx                              │
│                                                                        │
│  ┌─────────────────────── Top Controls Bar ────────────────────────┐   │
│  │  Deck Select  ·  Study Mode Selector ('pinyin_to_hanzi')  ·  ...│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌──────────────────── Unified Card Container ─────────────────────┐   │
│  │  Sheet Switcher: [✍️ Luyện Viết] [🗣️ Luyện Đọc] [⌨️ Luyện Gõ]      │   │
│  │                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │ Sheet 3: PinyinTypingView                                 │  │   │
│  │  │  - Prompt: Meaning + Context Clue + Audio Play Button     │  │   │
│  │  │  - Input Field: Auto-focused Pinyin Text Input            │  │   │
│  │  │  - IME Simulator: Candidate Characters [1. 他  2. 她]    │  │   │
│  │  │  - Mobile Quick Tone Bar: [ā  á  ǎ  à  ē  é  ě  è...]     │  │   │
│  │  │  - Action Buttons: [Kiểm tra / Enter]  [Xem gợi ý / Hint] │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  │                                                                 │   │
│  │  Rating Bar (SM-2): [1. Chưa nhớ] [2. Khó] [3. Nhớ tốt] [4. Dễ] │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        storageService & SRS                            │
│  - recordReview(card, rating, mode: 'pinyin_typing')                   │
│  - Sync to LocalStorage & Cloud Firestore ('study_logs', 'cards')      │
└────────────────────────────────────────────────────────────────────────┘
```

### Component & State Mapping

1. **`src/types/index.ts`**:
   - Mở rộng `StudyMode`: thêm `'pinyin_to_hanzi'`.
   - Cập nhật kiểu `activeSheet` trong `StudySession`: `'writing' | 'reading' | 'typing'`.
2. **Bộ tiện ích chuẩn hóa Pinyin (`src/services/pinyinHelper.ts`)**:
   - `removeToneMarks(pinyin: string): string`: Biến `nǐ hǎo` $\to$ `ni hao`.
   - `parseNumericPinyin(input: string): string`: Biến `ni3 hao3` $\to$ `ni hao` / `nǐ hǎo`.
   - `isPinyinMatch(userInput: string, targetPinyin: string): boolean`: So khớp linh hoạt cả 3 kiểu gõ.
   - `generateImeCandidates(targetCard: Card, allCards: Card[])`: Tạo danh sách 3-4 ứng viên chữ Hán để người học chọn.
3. **Thành phần giao diện `StudySession.tsx`**:
   - Thêm tab Sheet 3 `⌨️ Sheet 3: Luyện Gõ Pinyin`.
   - Thêm tùy chọn `⌨️ Gõ Pinyin → Chữ Hán` trong dropdown chế độ học.
   - Quản lý state gõ phím: `typingInput`, `isAnswerRevealed`, `isTypingCorrect`, `typingAttempts`, `selectedImeIndex`.
   - Phím tắt bàn phím: `Enter` để nộp, `Space` / `1-4` để chọn ứng viên, `Tab` để xem gợi ý.
4. **Lưu trữ & Thống kê**:
   - Khi hoàn thành từ gõ đúng $\to$ gọi `onRecordReview(card, 4, 'pinyin_typing')`.
   - Cập nhật nhật ký ôn tập `StudyLog` với `mode: 'pinyin_typing'`.

---
