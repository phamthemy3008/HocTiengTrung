import React from 'react';
import {
  Flame,
  Camera,
  Layers,
  BarChart3,
  BookOpen,
  Settings,
  LogIn,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  ShieldCheck,
  HelpCircle,
  MessageSquarePlus,
  AlertTriangle,
} from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  activeTab: 'study' | 'decks' | 'dashboard' | 'admin';
  setActiveTab: (tab: 'study' | 'decks' | 'dashboard' | 'admin') => void;
  openOcrModal: () => void;
  openSettingsModal: () => void;
  openUserGuide: () => void;
  openFeedbackModal: () => void;
  openWeakCardsModal: () => void;
  weakCardsCount: number;
  profile: UserProfile;
  currentUser: any;
  onLogin: () => void;
  onLogout: () => void;
  isOnline: boolean;
  dueTodayCount: number;
  isLoggingIn?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  openOcrModal,
  openSettingsModal,
  openUserGuide,
  openFeedbackModal,
  openWeakCardsModal,
  weakCardsCount,
  profile,
  currentUser,
  onLogin,
  onLogout,
  isOnline,
  dueTodayCount,
  isLoggingIn = false,
}) => {
  const isAdmin = currentUser?.email?.trim().toLowerCase() === 'phamthemy3008@gmail.com';

  return (
    <header className="sticky top-0 z-30 bg-[#fdfbf7]/90 backdrop-blur-md border-b border-stone-200/80 transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setActiveTab('study')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            {/* Traditional Chinese Seal Stamp */}
            <div className="w-10 h-10 rounded-xl bg-red-700 text-amber-50 flex items-center justify-center font-hanzi font-bold text-xl shadow-xs border border-red-800 group-hover:bg-red-800 transition-colors">
              汉
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-stone-900 tracking-tight text-base sm:text-lg">
                  Học Tiếng Trung
                </span>
                <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-900 border border-amber-200/60">
                  Hán Ngữ
                </span>
              </div>
              <p className="text-[11px] text-stone-500 hidden sm:block">
                Học từ vựng & Luyện viết chữ Hán
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-stone-100/80 p-1 rounded-xl border border-stone-200/60 text-xs sm:text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('study')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'study'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <BookOpen className="w-4 h-4 text-red-700" />
            <span>Luyện tập</span>
            {dueTodayCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
                {dueTodayCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('decks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'decks'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-700" />
            <span className="hidden sm:inline">Bộ từ vựng</span>
            <span className="sm:hidden">Bộ từ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-700" />
            <span>Tiến độ</span>
          </button>

          {/* Admin Tab - Only visible to phamthemy3008@gmail.com */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'admin'
                  ? 'bg-red-700 text-white shadow-xs font-semibold'
                  : 'text-red-700 hover:text-red-800 hover:bg-red-50 font-medium'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Quản Trị Hệ Thống</span>
              <span className="sm:hidden">Admin</span>
            </button>
          )}
        </nav>

        {/* Right Actions: Guide, Feedback, Weak Cards, OCR, Streak, Auth, Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Sổ Tay Từ Hay Sai Button */}
          <button
            type="button"
            onClick={openWeakCardsModal}
            title="Mở Sổ Tay Từ Hay Sai & Khó Nhớ"
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-2xs ${
              weakCardsCount > 0
                ? 'text-red-900 bg-red-50 hover:bg-red-100 border-red-200'
                : 'text-stone-700 bg-white hover:bg-stone-50 border-stone-200'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${weakCardsCount > 0 ? 'text-red-600' : 'text-stone-500'}`} />
            <span className="hidden lg:inline">Từ khó</span>
            {weakCardsCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-red-600 text-white">
                {weakCardsCount}
              </span>
            )}
          </button>

          {/* User Guide Button (Requirement 5) */}
          <button
            type="button"
            onClick={openUserGuide}
            title="Hướng dẫn sử dụng ứng dụng"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200/80 transition-colors shadow-2xs"
          >
            <HelpCircle className="w-4 h-4 text-amber-700" />
            <span className="hidden lg:inline">Hướng dẫn</span>
          </button>

          {/* Feedback Button (Requirement 6) */}
          <button
            type="button"
            onClick={openFeedbackModal}
            title="Gửi góp ý hoặc báo lỗi cho Admin"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 rounded-lg border border-stone-200 shadow-2xs transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4 text-red-700" />
            <span className="hidden lg:inline">Góp ý</span>
          </button>

          {/* OCR Quick Button */}
          <button
            type="button"
            onClick={openOcrModal}
            title="Quét từ vựng từ Camera hoặc ảnh chụp"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 rounded-lg border border-stone-200 transition-colors shadow-2xs"
          >
            <Camera className="w-4 h-4 text-stone-600" />
            <span className="hidden md:inline">Quét OCR</span>
          </button>

          {/* Streak Badge */}
          <div
            title={`Chuỗi ngày học liên tục: ${profile.streak} ngày`}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200/70 rounded-lg"
          >
            <Flame className="w-4 h-4 text-orange-600 fill-orange-500 animate-pulse" />
            <span>{profile.streak}</span>
          </div>

          {/* Network indicator */}
          <div
            title={isOnline ? 'Đang online (Đồng bộ Cloud)' : 'Chế độ Offline (Lưu tại máy)'}
            className="hidden xl:flex items-center text-stone-400"
          >
            {isOnline ? (
              <Wifi className="w-4 h-4 text-emerald-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-stone-400" />
            )}
          </div>

          {/* Google Auth / Profile */}
          {currentUser ? (
            <div className="flex items-center gap-1.5">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-7 h-7 rounded-full border border-stone-200 shadow-2xs object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-bold">
                  {(currentUser.displayName || 'U')[0].toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={onLogout}
                title="Đăng xuất"
                className="p-1.5 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              disabled={isLoggingIn}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 rounded-lg border border-stone-200 shadow-2xs transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                <RefreshCw className="w-3.5 h-3.5 text-red-700 animate-spin" />
              ) : (
                <LogIn className="w-3.5 h-3.5 text-red-700" />
              )}
              <span className="hidden sm:inline">
                {isLoggingIn ? 'Đang vào...' : 'Đăng nhập'}
              </span>
            </button>
          )}

          {/* Settings Modal Button */}
          <button
            type="button"
            onClick={openSettingsModal}
            title="Cài đặt & Nhắc nhở"
            className="p-1.5 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

