import React, { useState, useId } from 'react';
import {
  Bell,
  X,
  Target,
  Volume2,
  Cloud,
  Check,
  Smartphone,
  Eye,
  Shuffle,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { AppSettings, storageService } from '../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onLogout,
  isLoggingIn = false,
}) => {
  const dailyGoalSelectId = useId();
  const defaultModeSelectId = useId();
  const [settings, setSettings] = useState<AppSettings>(() => storageService.getSettings());
  const [notificationStatus, setNotificationStatus] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [savedToast, setSavedToast] = useState<boolean>(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdate = (patch: Partial<AppSettings>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    storageService.saveSettings(updated);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  // Request browser notification permission
  const handleRequestNotification = async () => {
    if (typeof Notification === 'undefined') {
      setNoticeMessage('Trình duyệt của bạn hiện không hỗ trợ Web Notifications.');
      setTimeout(() => setNoticeMessage(null), 4000);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      if (permission === 'granted') {
        handleUpdate({ reminderEnabled: true });
        new Notification('HanziSRS - Nhắc Nhở Ôn Tập', {
          body: 'Đã kích hoạt tính năng nhắc nhở ôn tập từ vựng hàng ngày!',
          icon: '/favicon.ico',
        });
      }
    } catch {
      setNoticeMessage('Không thể yêu cầu quyền thông báo.');
      setTimeout(() => setNoticeMessage(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200/80 flex items-center justify-between bg-[#fbf9f5]">
          <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
            <span>Cài Đặt Ứng Dụng & Nhắc Nhở</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
          {/* Daily Reminder Notification */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                <Bell className="w-4 h-4 text-amber-700" />
                <span>Nhắc Nhở Ôn Tập Hàng Ngày</span>
              </div>
              <input
                type="checkbox"
                checked={settings.reminderEnabled && notificationStatus === 'granted'}
                onChange={(e) => {
                  if (e.target.checked && notificationStatus !== 'granted') {
                    handleRequestNotification();
                  } else {
                    handleUpdate({ reminderEnabled: e.target.checked });
                  }
                }}
                className="w-4 h-4 accent-red-700 rounded cursor-pointer"
              />
            </div>

            <p className="text-stone-600 leading-relaxed">
              Nhắc bạn mở app đúng giờ mỗi ngày để không bị đứt chuỗi (streak) và ôn tập từ vựng đúng thời điểm SRS.
            </p>

            <div className="flex items-center justify-between pt-1">
              <span className="font-medium text-stone-700">Giờ nhắc nhở mỗi ngày:</span>
              <input
                type="time"
                value={settings.reminderTime}
                onChange={(e) => handleUpdate({ reminderTime: e.target.value })}
                className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-stone-800 font-semibold focus:outline-none focus:ring-1 focus:ring-red-600"
              />
            </div>

            {notificationStatus !== 'granted' && (
              <button
                type="button"
                onClick={handleRequestNotification}
                className="w-full py-1.5 px-3 rounded-lg bg-amber-200/80 hover:bg-amber-300/80 text-amber-950 font-semibold text-[11px] transition-colors"
              >
                Cấp quyền thông báo trình duyệt
              </button>
            )}

            {noticeMessage && (
              <p className="text-[11px] text-amber-800 bg-amber-100/70 p-2 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{noticeMessage}</span>
              </p>
            )}
          </div>

          {/* Daily Goal */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor={dailyGoalSelectId} className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                <Target className="w-4 h-4 text-red-700" />
                <span>Mục Tiêu Từ Vựng / Ngày</span>
              </label>
              <select
                id={dailyGoalSelectId}
                value={settings.dailyGoal}
                onChange={(e) => handleUpdate({ dailyGoal: Number(e.target.value) })}
                className="px-3 py-1 bg-white border border-stone-300 rounded-lg text-stone-800 font-semibold focus:outline-none focus:ring-1 focus:ring-red-600"
              >
                <option value={10}>10 từ / ngày (Nhẹ nhàng)</option>
                <option value={20}>20 từ / ngày (Khuyến nghị)</option>
                <option value={30}>30 từ / ngày (Chăm chỉ)</option>
                <option value={50}>50 từ / ngày (Tăng tốc HSK)</option>
              </select>
            </div>
            <p className="text-stone-500">
              Số lượng thẻ ôn tập bạn đặt mục tiêu hoàn thành mỗi ngày để giữ vững tiến độ.
            </p>
          </div>

          {/* Study Mode Default */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor={defaultModeSelectId} className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                <Shuffle className="w-4 h-4 text-emerald-700" />
                <span>Chế Độ Luyện Tập Mặc Định</span>
              </label>
              <select
                id={defaultModeSelectId}
                value={settings.defaultStudyMode}
                onChange={(e) => handleUpdate({ defaultStudyMode: e.target.value as any })}
                className="px-3 py-1 bg-white border border-stone-300 rounded-lg text-stone-800 font-semibold focus:outline-none focus:ring-1 focus:ring-red-600"
              >
                <option value="random">Ngẫu nhiên xen kẽ</option>
                <option value="vietnamese_to_writing">Ưu tiên tập viết Hán tự</option>
                <option value="hanzi_to_meaning">Ưu tiên đọc & nhớ nghĩa</option>
              </select>
            </div>
          </div>

          {/* Ghost Outline Setting */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                <Eye className="w-4 h-4 text-amber-700" />
                <span>Nét Mẫu Mờ Trong Ô Mễ Tự</span>
              </div>
              <input
                type="checkbox"
                checked={settings.showGhostOutline}
                onChange={(e) => handleUpdate({ showGhostOutline: e.target.checked })}
                className="w-4 h-4 accent-red-700 rounded cursor-pointer"
              />
            </div>
            <p className="text-stone-500">
              {settings.showGhostOutline
                ? 'Hiện nét mờ mẫu khi bắt đầu viết.'
                : 'Mặc định ẩn nét mẫu để thử thách trí nhớ (bạn vẫn có thể nhấn nút "Hiện nét mẫu" bất kỳ lúc nào).'}
            </p>
          </div>

          {/* Cloud Sync Status & Account */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                <Cloud className="w-4 h-4 text-blue-600" />
                <span>Đồng Bộ Đám Mây & Tài Khoản</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Offline-First</span>
              </span>
            </div>

            {currentUser ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-stone-200">
                  {currentUser.photoURL && (
                    <img
                      src={currentUser.photoURL}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full border border-stone-200"
                    />
                  )}
                  <div className="flex-1 overflow-hidden">
                    <div className="font-semibold text-stone-900 truncate">
                      {currentUser.displayName || 'Tài khoản Google'}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">
                      {currentUser.email}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full py-1.5 px-3 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold text-xs transition-colors"
                >
                  Đăng Xuất
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-stone-500 leading-relaxed">
                  Đăng nhập bằng tài khoản Google để tự động sao lưu và đồng bộ bộ từ vựng giữa điện thoại, máy tính bảng và máy tính cá nhân.
                </p>
                <button
                  type="button"
                  onClick={onLogin}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang kết nối Google...</span>
                    </>
                  ) : (
                    <span>Đăng Nhập Bằng Google</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-[#fbf9f5] flex items-center justify-between">
          <span className="text-[11px] text-stone-400">
            {savedToast ? '✓ Đã tự động lưu' : 'HanziSRS v1.0 • Phiên bản tối giản'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition-colors"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
};
