import React, { useState, useEffect } from 'react';
import {
  Heart,
  Coffee,
  X,
  Copy,
  Check,
  QrCode,
  Sparkles,
  Edit3,
  Save,
  CreditCard,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DonationInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  momoPhone: string;
  transferContent: string;
  customMessage: string;
}

const DEFAULT_DONATION_INFO: DonationInfo = {
  bankName: 'MB Bank (Ngân hàng Quân Đội)',
  accountNumber: '0987830111',
  accountHolder: 'PHAM THE MY',
  momoPhone: '0987830111',
  transferContent: 'Ủng hộ Học Tiếng Trung',
  customMessage:
    'Cảm ơn bạn đã đồng hành và sử dụng ứng dụng Học Tiếng Trung! Sự ủng hộ của bạn là nguồn động lực to lớn giúp mình duy trì và tiếp tục phát triển ứng dụng ngày càng tốt hơn.',
};

const STORAGE_KEY = 'hoctiengtrung_donation_info_v2';

export const DonationModal: React.FC<DonationModalProps> = ({ isOpen, onClose }) => {
  const [donationInfo, setDonationInfo] = useState<DonationInfo>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_DONATION_INFO, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_DONATION_INFO;
  });

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<DonationInfo>(donationInfo);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setEditForm(donationInfo);
  }, [donationInfo]);

  if (!isOpen) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setDonationInfo(editForm);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(editForm));
    } catch {}
    setIsEditing(false);
  };

  // Generate VietQR URL if bank info is available
  // Format: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-compact2.png?amount=&addInfo=&accountName=
  const cleanBankName = donationInfo.bankName.toLowerCase();
  const bankBin = cleanBankName.includes('mb')
    ? 'MB'
    : cleanBankName.includes('vietcombank') || cleanBankName.includes('vcb')
    ? 'VCB'
    : cleanBankName.includes('techcom')
    ? 'TCB'
    : cleanBankName.includes('vp')
    ? 'VPB'
    : cleanBankName.includes('acb')
    ? 'ACB'
    : 'MB';

  const vietQrUrl = `https://img.vietqr.io/image/${bankBin}-${donationInfo.accountNumber.trim()}-compact2.png?addInfo=${encodeURIComponent(
    donationInfo.transferContent
  )}&accountName=${encodeURIComponent(donationInfo.accountHolder)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 overflow-hidden relative max-h-[92vh] flex flex-col">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shadow-2xs">
              <Heart className="w-5 h-5 fill-rose-500 text-rose-600 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base sm:text-lg flex items-center gap-1.5">
                <span>Ủng Hộ Tác Giả</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold border border-amber-200/70">
                  Buy me a coffee ☕
                </span>
              </h3>
              <p className="text-xs text-stone-500 font-medium">
                Tác giả: <strong className="text-stone-800">Phạm Thế Mỹ</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto py-4 space-y-4 pr-1">
          {/* Author Message */}
          <div className="p-3.5 bg-gradient-to-r from-amber-50/80 via-rose-50/50 to-orange-50/80 border border-amber-200/70 rounded-2xl text-xs text-stone-700 leading-relaxed shadow-2xs">
            <p className="font-medium text-stone-800 mb-1 flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Lời ngỏ từ người phát triển:</span>
            </p>
            <p className="text-stone-600 italic">
              "{donationInfo.customMessage}"
            </p>
          </div>

          {!isEditing ? (
            <div className="space-y-4">
              {/* Bank Transfer Card */}
              <div className="p-4 bg-[#faf9f5] border border-stone-200 rounded-2xl space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                    <CreditCard className="w-4 h-4 text-red-700" />
                    <span>Chuyển Khoản Ngân Hàng</span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    VietQR 24/7
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                  <div>
                    <div className="text-[11px] text-stone-400 font-medium">Ngân hàng:</div>
                    <div className="font-semibold text-stone-800 mt-0.5">{donationInfo.bankName}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-stone-400 font-medium">Chủ tài khoản:</div>
                    <div className="font-bold text-stone-900 uppercase mt-0.5">{donationInfo.accountHolder}</div>
                  </div>
                </div>

                {/* Account Number Box with Copy */}
                <div className="flex items-center justify-between p-2.5 bg-white border border-stone-200 rounded-xl">
                  <div>
                    <div className="text-[10px] text-stone-400 uppercase font-semibold">Số tài khoản:</div>
                    <div className="text-base font-mono font-bold text-red-700 tracking-wider">
                      {donationInfo.accountNumber}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(donationInfo.accountNumber, 'stk')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      copiedField === 'stk'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    {copiedField === 'stk' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã chép!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Transfer Content Box */}
                <div className="flex items-center justify-between p-2.5 bg-white border border-stone-200 rounded-xl">
                  <div>
                    <div className="text-[10px] text-stone-400 uppercase font-semibold">Nội dung chuyển khoản:</div>
                    <div className="text-xs font-medium text-stone-800">
                      {donationInfo.transferContent}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(donationInfo.transferContent, 'content')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      copiedField === 'content'
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    {copiedField === 'content' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedField === 'content' ? 'Đã chép' : 'Chép'}</span>
                  </button>
                </div>

                {/* QR Code preview */}
                <div className="pt-1 flex flex-col items-center justify-center text-center">
                  <div className="p-2 bg-white rounded-2xl border border-stone-200 shadow-2xs">
                    <img
                      src={vietQrUrl}
                      alt="VietQR Mã Chuyển Khoản"
                      className="w-48 h-auto object-contain rounded-xl mx-auto"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-stone-400 mt-1.5 flex items-center gap-1">
                    <QrCode className="w-3 h-3 text-stone-400" />
                    Quét mã QR bằng ứng dụng ngân hàng bất kỳ để chuyển nhanh
                  </span>
                </div>
              </div>

              {/* MoMo Card */}
              {donationInfo.momoPhone && (
                <div className="p-3.5 bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-2xl flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#a50064] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      MoMo
                    </div>
                    <div>
                      <div className="text-xs font-bold text-stone-800">Ví MoMo</div>
                      <div className="text-xs font-mono font-semibold text-stone-600">
                        {donationInfo.momoPhone} • {donationInfo.accountHolder}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(donationInfo.momoPhone, 'momo')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      copiedField === 'momo'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white hover:bg-pink-100 text-stone-700 border border-pink-200 shadow-2xs'
                    }`}
                  >
                    {copiedField === 'momo' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã chép!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Chép SĐT</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Edit Form (Cho phép chủ app tùy chỉnh STK và thông điệp) */
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div className="font-bold text-stone-800 text-sm flex items-center gap-1.5 mb-2">
                <Edit3 className="w-4 h-4 text-amber-700" />
                <span>Chỉnh Sửa Thông Tin Nhận Ủng Hộ (Tùy Biến)</span>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Tên Ngân Hàng:
                </label>
                <input
                  type="text"
                  required
                  value={editForm.bankName}
                  onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Số tài khoản:
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.accountNumber}
                    onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Chủ tài khoản:
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.accountHolder}
                    onChange={(e) => setEditForm({ ...editForm, accountHolder: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600 uppercase font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Số điện thoại MoMo:
                  </label>
                  <input
                    type="text"
                    value={editForm.momoPhone}
                    onChange={(e) => setEditForm({ ...editForm, momoPhone: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Nội dung mẫu:
                  </label>
                  <input
                    type="text"
                    value={editForm.transferContent}
                    onChange={(e) => setEditForm({ ...editForm, transferContent: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Lời nhắn gửi của bạn:
                </label>
                <textarea
                  rows={2}
                  value={editForm.customMessage}
                  onChange={(e) => setEditForm({ ...editForm, customMessage: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-stone-600 hover:bg-stone-200 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu thông tin</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="text-stone-400 hover:text-stone-700 flex items-center gap-1 text-[11px]"
          >
            <Edit3 className="w-3 h-3" />
            <span>{isEditing ? 'Hủy sửa' : 'Tùy chỉnh thông tin nhận'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl shadow-2xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
