import React, { useState } from 'react';
import {
  X,
  BookOpen,
  PenTool,
  Mic,
  Brain,
  Layers,
  Sparkles,
  Camera,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Flame,
  Volume2,
  ShieldCheck,
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'writing' | 'reading' | 'srs' | 'tools'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/80 bg-[#fbf9f5]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-700 text-white flex items-center justify-center font-bold shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
                <span>Hướng Dẫn Sử Dụng Ứng Dụng</span>
                <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                  Hán Ngữ Chuẩn
                </span>
              </h2>
              <p className="text-xs text-stone-500">Mẹo học nhanh, luyện viết đúng bút thuận và phát âm chuẩn bản xứ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 bg-stone-50 border-b border-stone-200/70 overflow-x-auto text-xs font-semibold scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveSection('overview')}
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              activeSection === 'overview'
                ? 'bg-red-700 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-stone-200/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>1. Tổng quan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('writing')}
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              activeSection === 'writing'
                ? 'bg-red-700 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-stone-200/60'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>2. Luyện Tập Viết</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('reading')}
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              activeSection === 'reading'
                ? 'bg-red-700 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-stone-200/60'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>3. Luyện Phát Âm AI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('srs')}
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              activeSection === 'srs'
                ? 'bg-red-700 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-stone-200/60'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>4. Thuật toán SM-2</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('tools')}
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              activeSection === 'tools'
                ? 'bg-red-700 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-stone-200/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>5. Quản lý & OCR</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm text-stone-700 leading-relaxed">
          {activeSection === 'overview' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Chào mừng bạn đến với ứng dụng Học Tiếng Trung Hán Ngữ!</span>
                </h3>
                <p className="text-xs text-stone-600">
                  Ứng dụng được thiết kế nhằm giúp người học giải quyết 3 trở ngại lớn nhất khi học tiếng Trung: 
                  <strong> Nhớ mặt chữ Hán</strong>, <strong>Viết đúng quy tắc bút thuận</strong> và <strong>Phát âm chuẩn xác thanh điệu</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-white border border-stone-200 rounded-2xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <div className="w-6 h-6 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">✍️</div>
                    <span>Luyện Tập Viết Bút Thuận</span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Viết trực tiếp trên ô Mễ tự (米字格). Tự động phát hiện đúng/sai từng nét. Viết đúng 100% sẽ tự động nhảy sang từ mới.
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-stone-200 rounded-2xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">🗣️</div>
                    <span>Luyện Đọc & Chấm Điểm AI</span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Đánh giá đồng thời 2 điểm: Phát âm & Thanh điệu, gạch chân từng chữ Hán, chỉ rõ lỗi lệch âm và cho phép nghe lại bản ghi của bạn.
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-stone-200 rounded-2xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">🧠</div>
                    <span>Lặp Lại Ngắt Quãng SM-2</span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Tối ưu thời gian học: Những từ đã nhớ lâu sẽ ôn cách xa, những từ hay quên sẽ được nhắc lại thường xuyên.
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-stone-200 rounded-2xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold">☁️</div>
                    <span>Lưu Trữ Đồng Bộ Đám Mây</span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Đăng nhập bằng tài khoản Google để tiến độ ôn tập, chuỗi Streak và bộ từ vựng được đồng bộ liên tục trên mọi thiết bị.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'writing' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-red-50/60 border border-red-200/80 rounded-2xl space-y-2">
                <h3 className="font-bold text-red-950 text-sm flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-red-700" />
                  <span>Cách Sử Dụng Chế Độ Tập Viết Hán Tự</span>
                </h3>
                <p className="text-xs text-stone-600">
                  Phần viết chữ Hán được đưa lên trên cùng với ô Mễ tự (米字格) chuẩn thư pháp Hán ngữ.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5 p-3 bg-white border border-stone-200 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-stone-900 text-xs block">1. Viết từng nét theo quy tắc bút thuận</strong>
                    <span className="text-[11px] text-stone-500">
                      Quy tắc: Ngang trước sổ sau, trên trước dưới sau, trái trước phải sau, ngoài trước trong sau, vào trước đóng sau.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 bg-white border border-stone-200 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-stone-900 text-xs block">2. Tự động chuyển từ mới khi viết đúng 100%</strong>
                    <span className="text-[11px] text-stone-500">
                      Khi bạn hoàn thành viết đúng tất cả các chữ trong từ, hệ thống sẽ phát âm mẫu chuẩn, bắn pháo hoa chúc mừng và <strong>tự động chuyển sang từ tiếp theo</strong> mà bạn không cần phải bấm nút đánh giá SM-2 thủ công.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 bg-white border border-stone-200 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-stone-900 text-xs block">3. Nút Gợi ý mặt chữ & Mẫu nét</strong>
                    <span className="text-[11px] text-stone-500">
                      Nếu gặp từ khó chưa nhớ, bạn có thể bấm nút <em>"Gợi ý mặt chữ Hán"</em> hoặc bật icon mắt <em>"Hiện nét mờ"</em> để xem hướng dẫn trước khi viết.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'reading' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl space-y-2">
                <h3 className="font-bold text-blue-950 text-sm flex items-center gap-2">
                  <Mic className="w-4 h-4 text-blue-700" />
                  <span>Chế Độ Luyện Đọc & Thẩm Định Phát Âm AI</span>
                </h3>
                <p className="text-xs text-stone-600">
                  Giao diện phân tích ngữ âm toàn diện với 2 điểm số: <strong>Phát âm</strong> và <strong>Thanh điệu</strong>.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5 p-3 bg-white border border-stone-200 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0">1</div>
                  <div>
                    <strong className="text-stone-900 text-xs block">Nhấn nút Micro tròn lớn để thu âm</strong>
                    <span className="text-[11px] text-stone-500">
                      Bấm vào nút Micro tròn màu đen ở dưới cùng. Đọc to, rõ ràng từ vựng tiếng Trung. Khi đọc xong dừng 1 giây máy sẽ tự động chấm điểm hoặc bấm lại micro để kết thúc.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 bg-white border border-stone-200 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0">2</div>
                  <div>
                    <strong className="text-stone-900 text-xs block">Phân tích chi tiết từng âm tiết & lỗi sai</strong>
                    <span className="text-[11px] text-stone-500">
                      Dưới mỗi chữ Hán có gạch chân màu và điểm số riêng cho từng chữ. Phần dưới hiển thị các lỗi lệch âm (ví dụ: <code className="text-red-700 font-mono">g→w</code>, <code className="text-blue-700 font-mono">ong→en</code>) giúp bạn biết chính xác mình sai ở đâu.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 bg-white border border-stone-200 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0">3</div>
                  <div>
                    <strong className="text-stone-900 text-xs block">Nghe lại "Bản ghi của bạn" vs "Giọng bản ngữ"</strong>
                    <span className="text-[11px] text-stone-500">
                      Bấm nút <strong>"▶ Bản ghi của bạn"</strong> để nghe lại chính giọng đọc của mình, sau đó bấm nút <strong>"🔊 [Pinyin]"</strong> để so sánh với người bản xứ và sửa lại cho chuẩn.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'srs' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-2">
                <h3 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-emerald-700" />
                  <span>Khoa Học Thuật Toán Spaced Repetition (SM-2)</span>
                </h3>
                <p className="text-xs text-stone-600">
                  Dựa trên đường cong lãng quên của Hermann Ebbinghaus, não bộ sẽ quên 80% kiến thức sau 48 giờ nếu không được nhắc lại đúng thời điểm.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                  <span className="font-bold text-xs text-red-900">1. Quên (Again)</span>
                  <p className="text-[11px] text-red-700">Ôn lại ngay trong ngày và giảm khoảng cách lặp lại về 1 ngày.</p>
                </div>
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-1">
                  <span className="font-bold text-xs text-orange-900">2. Khó (Hard)</span>
                  <p className="text-[11px] text-orange-700">Nhớ nhưng còn ngập ngừng. Khoảng cách ngày ôn tăng nhẹ.</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <span className="font-bold text-xs text-emerald-900">3. Tốt (Good)</span>
                  <p className="text-[11px] text-emerald-700">Nhớ tốt và phản xạ nhanh. Khoảng cách nhân với hệ số Ease Factor.</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                  <span className="font-bold text-xs text-blue-900">4. Dễ (Easy)</span>
                  <p className="text-[11px] text-blue-700">Đã thuộc lòng như tiếng mẹ đẻ. Khoảng cách ngày ôn tăng tối đa.</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'tools' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-stone-100 rounded-2xl space-y-2">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-stone-700" />
                  <span>Bộ Từ Vựng, Lọc Bài Học & Quét Ảnh OCR</span>
                </h3>
                <p className="text-xs text-stone-600">
                  Tận dụng tối đa các công cụ thông minh để quản lý và học tập hiệu quả.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-white border border-stone-200 rounded-xl">
                  <strong className="text-stone-900 text-xs block mb-1">🏷️ Lọc học theo Tag / Bài học (HSK 1: Bài 1 - Bài 15)</strong>
                  <p className="text-[11px] text-stone-500">
                    Bạn có thể chọn 1 hoặc nhiều thẻ bài học (ví dụ: chỉ học "Bài 1" và "Bài 2") để tập trung ôn tập bài vừa học trên lớp.
                  </p>
                </div>

                <div className="p-3 bg-white border border-stone-200 rounded-xl">
                  <strong className="text-stone-900 text-xs block mb-1">📷 Quét ảnh OCR từ vựng bằng Camera</strong>
                  <p className="text-[11px] text-stone-500">
                    Bấm nút <em>"Quét ảnh OCR"</em> trên thanh menu, chụp ảnh giáo trình hoặc sách bài tập để AI tự động trích xuất chữ Hán, Pinyin, dịch nghĩa và tạo flashcard ngay lập tức.
                  </p>
                </div>

                <div className="p-3 bg-white border border-stone-200 rounded-xl">
                  <strong className="text-stone-900 text-xs block mb-1">📬 Gửi góp ý cho Quản trị viên</strong>
                  <p className="text-[11px] text-stone-500">
                    Nếu phát hiện từ vựng cần chỉnh sửa hoặc có ý tưởng tính năng mới, hãy đăng nhập và bấm nút Góp ý để gửi thẳng đến Quản trị viên.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">
            Chúc bạn học tiếng Trung ngày càng tiến bộ!
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-xl shadow-xs transition-colors"
          >
            Đã Hiểu & Bắt Đầu Học
          </button>
        </div>
      </div>
    </div>
  );
};
