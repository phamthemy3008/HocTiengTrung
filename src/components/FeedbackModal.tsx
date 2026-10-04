import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { MessageSquarePlus, X, Send, CheckCircle2, AlertCircle, Sparkles, LogIn } from 'lucide-react';
import { feedbackService } from '../services/feedbackService';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLoginRequest?: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginRequest,
}) => {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [category, setCategory] = useState<'content' | 'bug' | 'feature' | 'other'>('content');
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (currentUser) {
        setName(currentUser.displayName || '');
        setEmail(currentUser.email || '');
      } else {
        setName('');
        setEmail('');
      }
      setSubmitted(false);
      setError(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError('Bạn cần đăng nhập để gửi góp ý.');
      return;
    }
    if (!message.trim()) {
      setError('Vui lòng nhập nội dung góp ý.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await feedbackService.submitFeedback({
        userId: currentUser.uid,
        name: name.trim() || currentUser.displayName || 'Người học',
        email: email.trim() || currentUser.email || '',
        category,
        message: message.trim(),
      });

      if (res.success) {
        setSubmitted(true);
        setMessage('');
        setTimeout(() => {
          onClose();
        }, 2500);
      } else {
        setError(res.error || 'Có lỗi khi gửi góp ý. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi gửi góp ý.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-50 text-red-700 rounded-xl">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900">Góp Ý & Báo Lỗi Cho Quản Trị Viên</h2>
              <p className="text-xs text-stone-500">Mọi phản hồi sẽ được gửi thẳng tới hòm thư của Admin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Not Logged In View */}
        {!currentUser ? (
          <div className="p-7 text-center space-y-4">
            <div className="w-14 h-14 mx-auto bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center">
              <LogIn className="w-7 h-7 text-amber-700" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-stone-900">Yêu Cầu Đăng Nhập</h3>
              <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
                Để bảo vệ hệ thống khỏi tin nhắn rác và để Quản trị viên có thể phản hồi trực tiếp tới bạn, 
                bạn cần <strong>đăng nhập tài khoản Google</strong> trước khi gửi góp ý.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLoginRequest?.();
                }}
                className="px-5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng Nhập Ngay</span>
              </button>
            </div>
          </div>
        ) : submitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-stone-900">Cảm Ơn Bạn Đã Góp Ý!</h3>
            <p className="text-xs text-stone-600 max-w-xs mx-auto">
              Tin nhắn của bạn đã được chuyển tới Quản trị viên (Admin). Chúng tôi sẽ xem xét và cập nhật sớm nhất!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Category selection */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Chủ đề góp ý:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setCategory('content')}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    category === 'content'
                      ? 'border-red-600 bg-red-50/50 text-red-900 font-semibold'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  📝 Sửa từ vựng / Pinyin
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('bug')}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    category === 'bug'
                      ? 'border-red-600 bg-red-50/50 text-red-900 font-semibold'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  🐞 Báo lỗi hệ thống / App
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('feature')}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    category === 'feature'
                      ? 'border-red-600 bg-red-50/50 text-red-900 font-semibold'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  💡 Đề xuất tính năng mới
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('other')}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    category === 'other'
                      ? 'border-red-600 bg-red-50/50 text-red-900 font-semibold'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  💬 Ý kiến khác
                </button>
              </div>
            </div>

            {/* Name & Email (Auto-filled from user) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Tên người gửi:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Minh Châu"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Email (để Admin phản hồi):
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nội dung chi tiết: <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ví dụ: Bài 3 từ '中国' có thể bổ sung thêm ví dụ... hoặc Phát âm phần thu âm đọc thử bài 2..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-red-600 resize-none"
                required
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-stone-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Gửi trực tiếp lên Cloud DB</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !message.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-xl shadow-xs transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Đang gửi...' : 'Gửi góp ý'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
