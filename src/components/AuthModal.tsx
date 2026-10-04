import React, { useState } from 'react';
import {
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  X,
  LogIn,
  AlertCircle,
  HelpCircle,
  HardDriveDownload,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: { code: string; message: string } | null;
  onRetryLogin: () => void;
  isLoggingIn: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  error,
  onRetryLogin,
  isLoggingIn,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isUnauthorizedDomain =
    error?.code === 'auth/unauthorized-domain' ||
    (error?.message && error.message.includes('unauthorized-domain'));
  const isPopupBlocked =
    error?.code === 'auth/popup-blocked' ||
    (error?.message && error.message.includes('popup-blocked'));

  const firebaseSettingsUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  const handleCopyHostname = async () => {
    try {
      await navigator.clipboard.writeText(currentHostname);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement('textarea');
      textarea.value = currentHostname;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-stone-200 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-[#fdfbf7]">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isUnauthorizedDomain
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {isUnauthorizedDomain ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base">
                {isUnauthorizedDomain
                  ? 'Cần cấp quyền Tên miền Firebase'
                  : 'Thông báo Đăng nhập Google'}
              </h3>
              <p className="text-xs text-stone-500">
                {isUnauthorizedDomain
                  ? 'Lỗi auth/unauthorized-domain'
                  : 'Xác thực tài khoản Google'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {isUnauthorizedDomain ? (
            <>
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 text-amber-900 text-xs sm:text-sm leading-relaxed">
                <p className="font-semibold mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  Nguyên nhân gây ra lỗi:
                </p>
                Firebase Authentication yêu cầu tên miền đang chạy ứng dụng phải
                được thêm vào danh sách{' '}
                <span className="font-semibold underline">
                  Authorized domains (Tên miền được ủy quyền)
                </span>{' '}
                của dự án Google Firebase để bảo vệ tài khoản khỏi truy cập trái
                phép.
              </div>

              {/* Current Domain Box */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wide">
                  Tên miền hiện tại của web cần ủy quyền:
                </label>
                <div className="flex items-center gap-2 bg-stone-100 border border-stone-300/80 rounded-xl p-2 sm:p-2.5">
                  <code className="text-xs sm:text-sm font-mono text-stone-800 break-all flex-1 px-1">
                    {currentHostname || currentOrigin}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyHostname}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-stone-50 text-stone-800 rounded-lg border border-stone-200 shadow-2xs transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-600" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action: Open Firebase Console */}
              <div className="pt-1">
                <a
                  href={firebaseSettingsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-xl shadow-xs transition-colors text-sm"
                >
                  <span>Mở Cài đặt Firebase Console</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <p className="text-[11px] text-stone-500 mt-1 text-center">
                  Dự án: <span className="font-mono text-stone-700">{firebaseConfig.projectId}</span>
                </p>
              </div>

              {/* Step-by-step instructions */}
              <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-4 space-y-2.5">
                <h4 className="font-semibold text-stone-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-stone-500" />
                  Hướng dẫn khắc phục trong 3 bước:
                </h4>
                <ol className="text-xs text-stone-600 space-y-2 list-decimal list-inside pl-1">
                  <li className="leading-relaxed">
                    Bấm nút <strong>"Mở Cài đặt Firebase Console"</strong> ở trên
                    để đến tab Settings của Authentication.
                  </li>
                  <li className="leading-relaxed">
                    Cuộn xuống phần{' '}
                    <strong className="text-stone-800">
                      Authorized domains (Tên miền được ủy quyền)
                    </strong>
                    , bấm nút <strong>Add domain (Thêm miền)</strong>.
                  </li>
                  <li className="leading-relaxed">
                    Dán tên miền{' '}
                    <code className="bg-stone-200 px-1 py-0.5 rounded font-mono text-[11px] text-stone-900">
                      {currentHostname}
                    </code>{' '}
                    vào rồi bấm <strong>Add (Lưu)</strong>.
                  </li>
                </ol>
              </div>

              {/* Offline note */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-emerald-900 text-xs">
                <HardDriveDownload className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <p>
                  <strong>Yên tâm tiếp tục học:</strong> Toàn bộ từ vựng, chuỗi ngày học
                  (streak), và tiến trình ghi nhớ SM-2 được lưu an toàn trên máy
                  của bạn ngay cả khi chưa đăng nhập Google!
                </p>
              </div>
            </>
          ) : isPopupBlocked ? (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-sm">
                <p className="font-semibold mb-1">Cửa sổ đăng nhập (Pop-up) bị chặn</p>
                Trình duyệt của bạn đang chặn cửa sổ đăng nhập của Google. Vui lòng
                kiểm tra thanh địa chỉ của trình duyệt, cho phép mở pop-up cho
                trang web này và thử lại.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-900 text-sm">
                <p className="font-semibold mb-1">Không thể hoàn tất đăng nhập</p>
                <p className="text-xs text-red-700 font-mono mt-1 break-words">
                  {error?.message || 'Đã xảy ra lỗi không xác định khi kết nối với Google.'}
                </p>
              </div>
              <p className="text-xs text-stone-600">
                Bạn có thể thử đăng nhập lại hoặc tiếp tục sử dụng ứng dụng ở chế độ
                Khách ngoại tuyến.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition-colors order-2 sm:order-1"
          >
            Tiếp tục học ở chế độ Khách
          </button>

          <button
            type="button"
            onClick={onRetryLogin}
            disabled={isLoggingIn}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 order-1 sm:order-2"
          >
            {isLoggingIn ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang kết nối...</span>
              </>
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" />
                <span>Thử đăng nhập lại</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
