import React from 'react';
import {
  Flame,
  Clock,
  CheckCircle2,
  TrendingUp,
  Brain,
  Award,
  Layers,
  Calendar,
  Sparkles,
  Target,
  BookOpen,
  MessageSquarePlus,
  HelpCircle,
} from 'lucide-react';
import { storageService } from '../services/storage';

interface DashboardProps {
  onStartStudy: () => void;
  onOpenGuide?: () => void;
  onOpenFeedback?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartStudy,
  onOpenGuide,
  onOpenFeedback,
}) => {
  const stats = storageService.getDashboardStats();

  const total = stats.totalCards || 1;
  const newPct = Math.round((stats.newCount / total) * 100);
  const learningPct = Math.round((stats.learningCount / total) * 100);
  const reviewPct = Math.round((stats.reviewCount / total) * 100);
  const masteredPct = Math.round((stats.masteredCount / total) * 100);

  const goalPct = Math.min(100, Math.round((stats.todayReviewsCount / stats.dailyGoal) * 100));

  // Max count in past 7 days for bar chart scaling
  const maxDayCount = Math.max(...stats.past7Days.map((d) => d.count), 5);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Top Welcome & Daily Goal Card */}
      <div className="bg-gradient-to-r from-red-800 to-amber-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        {/* Subtle Chinese Calligraphy Background watermark */}
        <div className="absolute right-4 -bottom-4 font-brush text-9xl text-white/5 select-none pointer-events-none">
          学无止境
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-amber-200 text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Học Không Ngừng Nghỉ • 学无止境</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Tiến Độ Học Tập & Ghi Nhớ Ngắt Quãng
            </h2>
            <p className="text-xs text-amber-100/80 max-w-lg leading-relaxed">
              Thuật toán Spaced Repetition (SM-2) theo dõi độ suy giảm trí nhớ và nhắc lại đúng thời điểm vàng trước khi bạn kịp quên.
            </p>
          </div>

          {/* Goal Ring & Study Action */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex items-center gap-4 shrink-0">
            <div>
              <div className="text-xs font-medium text-amber-200 mb-0.5">Mục tiêu hôm nay:</div>
              <div className="text-lg font-bold">
                {stats.todayReviewsCount} / {stats.dailyGoal} từ
              </div>
              <div className="w-32 h-2 bg-black/20 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${goalPct}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onStartStudy}
              className="px-4 py-2.5 rounded-xl bg-white text-stone-900 hover:bg-amber-50 font-bold text-xs shadow-sm transition-colors"
            >
              Ôn Tập Ngay
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Streak */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6 fill-orange-500" />
          </div>
          <div>
            <div className="text-xs text-stone-500 font-medium">Chuỗi ngày học</div>
            <div className="text-xl font-bold text-stone-900 mt-0.5">
              {stats.streak} <span className="text-xs font-normal text-stone-500">ngày</span>
            </div>
          </div>
        </div>

        {/* Due Today */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-stone-500 font-medium">Cần ôn hôm nay</div>
            <div className="text-xl font-bold text-stone-900 mt-0.5">
              {stats.dueToday} <span className="text-xs font-normal text-stone-500">thẻ</span>
            </div>
          </div>
        </div>

        {/* Retention Rate */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-stone-500 font-medium">Tỷ lệ nhớ đúng</div>
            <div className="text-xl font-bold text-stone-900 mt-0.5">
              {stats.retentionRate}%
            </div>
          </div>
        </div>

        {/* Total Cards */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-stone-500 font-medium">Tổng số từ vựng</div>
            <div className="text-xl font-bold text-stone-900 mt-0.5">
              {stats.totalCards} <span className="text-xs font-normal text-stone-500">từ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Spaced Repetition Mastery Stage Breakdown */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-red-700" />
            <h3 className="font-bold text-stone-900 text-base">
              Phân Bố Trí Nhớ (Giai Đoạn Lặp Lại SM-2)
            </h3>
          </div>
          <span className="text-xs text-stone-500 font-medium">
            {stats.totalCards} từ vựng
          </span>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="w-full h-3 rounded-full bg-stone-100 flex overflow-hidden">
          {stats.masteredCount > 0 && (
            <div
              style={{ width: `${masteredPct}%` }}
              title={`Đã thuộc: ${stats.masteredCount} từ (${masteredPct}%)`}
              className="bg-blue-600 transition-all duration-500"
            />
          )}
          {stats.reviewCount > 0 && (
            <div
              style={{ width: `${reviewPct}%` }}
              title={`Ôn tập định kỳ: ${stats.reviewCount} từ (${reviewPct}%)`}
              className="bg-emerald-600 transition-all duration-500"
            />
          )}
          {stats.learningCount > 0 && (
            <div
              style={{ width: `${learningPct}%` }}
              title={`Đang học: ${stats.learningCount} từ (${learningPct}%)`}
              className="bg-amber-500 transition-all duration-500"
            />
          )}
          {stats.newCount > 0 && (
            <div
              style={{ width: `${newPct}%` }}
              title={`Từ mới: ${stats.newCount} từ (${newPct}%)`}
              className="bg-stone-300 transition-all duration-500"
            />
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {/* Mastered */}
          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span>Đã thuộc (Mastered)</span>
            </div>
            <div className="text-lg font-bold text-blue-900 mt-1">
              {stats.masteredCount} <span className="text-xs font-normal text-blue-700">({masteredPct}%)</span>
            </div>
            <p className="text-[11px] text-blue-700 mt-0.5">Khoảng cách &gt; 21 ngày</p>
          </div>

          {/* Review */}
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>Ôn tập định kỳ</span>
            </div>
            <div className="text-lg font-bold text-emerald-900 mt-1">
              {stats.reviewCount} <span className="text-xs font-normal text-emerald-700">({reviewPct}%)</span>
            </div>
            <p className="text-[11px] text-emerald-700 mt-0.5">Khoảng cách 6 - 21 ngày</p>
          </div>

          {/* Learning */}
          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Đang củng cố</span>
            </div>
            <div className="text-lg font-bold text-amber-900 mt-1">
              {stats.learningCount} <span className="text-xs font-normal text-amber-700">({learningPct}%)</span>
            </div>
            <p className="text-[11px] text-amber-700 mt-0.5">Khoảng cách 1 - 5 ngày</p>
          </div>

          {/* New */}
          <div className="p-3 rounded-xl bg-stone-100 border border-stone-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
              <div className="w-2.5 h-2.5 rounded-full bg-stone-400" />
              <span>Từ mới (Chưa học)</span>
            </div>
            <div className="text-lg font-bold text-stone-900 mt-1">
              {stats.newCount} <span className="text-xs font-normal text-stone-600">({newPct}%)</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">Sẵn sàng để nạp</p>
          </div>
        </div>
      </div>

      {/* Weekly Activity Chart (7 Days) */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-700" />
            <h3 className="font-bold text-stone-900 text-base">
              Lịch Sử Ôn Tập 7 Ngày Qua
            </h3>
          </div>
          <span className="text-xs text-stone-500">
            Tổng {stats.past7Days.reduce((acc, d) => acc + d.count, 0)} lượt ôn
          </span>
        </div>

        {/* Bar Chart */}
        <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2 sm:px-6">
          {stats.past7Days.map((item, index) => {
            const heightPercent = Math.max(8, Math.round((item.count / maxDayCount) * 100));
            const isToday = index === stats.past7Days.length - 1;
            return (
              <div key={item.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[11px] font-bold text-stone-600">
                  {item.count > 0 ? item.count : ''}
                </span>
                <div
                  className="w-full max-w-[42px] rounded-t-lg transition-all duration-500"
                  style={{
                    height: `${heightPercent}%`,
                    backgroundColor: isToday ? '#b91c1c' : '#e7a09c',
                  }}
                  title={`${item.date}: ${item.count} lượt`}
                />
                <span className={`text-xs font-semibold ${isToday ? 'text-red-700' : 'text-stone-500'}`}>
                  {item.dayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Helpful Links (Guide & Feedback) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {onOpenGuide && (
          <button
            type="button"
            onClick={onOpenGuide}
            className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 hover:bg-amber-100/80 transition-all text-left flex items-start gap-3.5 group shadow-2xs"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                <span>Hướng Dẫn Sử Dụng Chi Tiết</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-semibold">Tài liệu</span>
              </h4>
              <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                Tìm hiểu về Spaced Repetition SM-2, mẹo luyện viết chuẩn nét Hán tự, và cách luyện đọc phát âm chuẩn người bản xứ.
              </p>
            </div>
          </button>
        )}

        {onOpenFeedback && (
          <button
            type="button"
            onClick={onOpenFeedback}
            className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 hover:bg-rose-100/80 transition-all text-left flex items-start gap-3.5 group shadow-2xs"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-200/80 text-rose-900 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                <span>Hòm Thư Góp Ý & Báo Lỗi</span>
                <span className="text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded font-semibold">Gửi Admin</span>
              </h4>
              <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                Đóng góp ý kiến cải tiến, phản ánh từ vựng chưa chuẩn hoặc đề xuất tính năng mới trực tiếp tới quản trị viên.
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};
