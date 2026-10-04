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
} from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  activeTab: 'study' | 'decks' | 'dashboard';
  setActiveTab: (tab: 'study' | 'decks' | 'dashboard') => void;
  openOcrModal: () => void;
  openSettingsModal: () => void;
  profile: UserProfile;
  currentUser: any;
  onLogin: () => void;
  onLogout: () => void;
  isOnline: boolean;
  dueTodayCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  openOcrModal,
  openSettingsModal,
  profile,
  currentUser,
  onLogin,
  onLogout,
  isOnline,
  dueTodayCount,
}) => {
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
        </nav>

        {/* Right Actions: OCR, Streak, Auth, Settings */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* OCR Quick Button */}
          <button
            type="button"
            onClick={openOcrModal}
            title="Quét từ vựng từ Camera hoặc ảnh chụp"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200/80 transition-colors shadow-2xs"
          >
            <Camera className="w-4 h-4 text-amber-700" />
            <span className="hidden md:inline">Quét ảnh OCR</span>
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
            className="hidden sm:flex items-center text-stone-400"
          >
            {isOnline ? (
              <Wifi className="w-4 h-4 text-emerald-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-stone-400" />
            )}
          </div>

          {/* Google Auth / Profile */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-stone-200 shadow-2xs object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-bold">
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 rounded-lg border border-stone-200 shadow-2xs transition-colors"
            >
              <LogIn className="w-4 h-4 text-red-700" />
              <span className="hidden sm:inline">Đăng nhập</span>
            </button>
          )}

          {/* Settings Modal Button */}
          <button
            type="button"
            onClick={openSettingsModal}
            title="Cài đặt & Nhắc nhở"
            className="p-2 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
