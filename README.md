# 🏮 HanziSRS - Ứng Dụng Học Từ Vựng & Luyện Viết Chữ Hán

[![Trang Web Trực Tuyến](https://img.shields.io/badge/Website-tiengtrung.thuongmy.info-red?style=for-the-badge&logo=google-chrome&logoColor=white)](https://tiengtrung.thuongmy.info/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-phamthemy3008%2FHocTiengTrung-black?style=for-the-badge&logo=github&logoColor=white)](https://github.com/phamthemy3008/HocTiengTrung)
[![Bản Quyền](https://img.shields.io/badge/Tác_Giả-Phạm_Thế_Mỹ-blue?style=for-the-badge)](https://tiengtrung.thuongmy.info/)

> 🌐 **Trang Web Trực Tuyến Chính Thức:** [https://tiengtrung.thuongmy.info/](https://tiengtrung.thuongmy.info/)
> 📂 **Mã Nguồn GitHub:** [https://github.com/phamthemy3008/HocTiengTrung](https://github.com/phamthemy3008/HocTiengTrung)

Ứng dụng web học tiếng Trung hiện đại kết hợp phương pháp Lặp lại ngắt quãng (Spaced Repetition System - SM-2), tập viết chữ Hán theo chuẩn bút thuận trên ô Mễ tự (米字格), kiểm tra phát âm giọng nói AI và nhận diện thẻ từ vựng qua ảnh chụp (OCR).

- **Tác giả:** Phạm Thế Mỹ
- **Hotline / Zalo / MoMo / MB Bank:** `0987830111`
- **Tên miền website:** [https://tiengtrung.thuongmy.info/](https://tiengtrung.thuongmy.info/)
- **Công nghệ:** React 19, TypeScript, Vite, Tailwind CSS v4, HanziWriter, Firebase Auth & Firestore, Web Speech API.

---

## 🚀 Hướng Dẫn Đẩy Mã Nguồn Lên GitHub

Mở Terminal tại thư mục dự án và thực hiện các lệnh sau:

```bash
# 1. Khởi tạo Git repository (nếu chưa có)
git init

# 2. Thêm toàn bộ file vào git
git add .

# 3. Tạo commit
git commit -m "feat: Cap nhat giao dien va tinh nang Hoc Tieng Trung"

# 4. Đổi tên branch chính thành main
git branch -M main

# 5. Liên kết trực tiếp với Repository GitHub chính thức
git remote add origin https://github.com/phamthemy3008/HocTiengTrung.git

# 6. Đẩy toàn bộ mã nguồn lên GitHub
git push -u origin main --force
```

---

## 🌐 Hướng Dẫn Deploy Lên Domain tiengtrung.thuongmy.info

Dự án được xây dựng bằng **Vite (React SPA)**, khi build sẽ tạo ra thư mục `dist/` chứa toàn bộ mã nguồn tĩnh (HTML, JS, CSS, Asset).

### Cách 1: Deploy lên Vercel / Netlify / Cloudflare Pages (Miễn phí & Tự động kết nối Domain)
1. Đăng nhập vào [Vercel](https://vercel.com) bằng tài khoản GitHub.
2. Chọn **"Add New Project"** -> Chọn Repo `phamthemy3008/HocTiengTrung`.
3. Cấu hình Build:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Bấm **"Deploy"**.
5. Vào mục **Settings -> Domains** -> Thêm tên miền riêng: `tiengtrung.thuongmy.info`. Trỏ bản ghi DNS CNAME theo hướng dẫn của Vercel.

---

### Cách 2: Deploy lên VPS / Server riêng (Nginx)

1. **Build dự án trên VPS:**
   ```bash
   npm install
   npm run build
   ```

2. **Cấu hình Nginx (`/etc/nginx/sites-available/tiengtrung.thuongmy.info`):**
   ```nginx
   server {
       listen 80;
       server_name tiengtrung.thuongmy.info;

       root /var/www/tiengtrung;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

3. **Kích hoạt Nginx và cấp SSL HTTPS miễn phí:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/tiengtrung.thuongmy.info /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   sudo certbot --nginx -d tiengtrung.thuongmy.info
   ```

---

## ☕ Ủng Hộ Tác Giả (Donate)

Nếu bạn thấy ứng dụng hữu ích cho việc học tập tiếng Trung, hãy ủng hộ tác giả một tách cà phê:
- **Tên tài khoản:** PHAM THE MY
- **Số tài khoản (MB Bank):** `0987830111`
- **Ví MoMo:** `0987830111`

*Chúc bạn học tập tiếng Trung thật tốt và thành công!*
