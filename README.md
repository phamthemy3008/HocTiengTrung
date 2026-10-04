# 🏮 HanziSRS - Ứng Dụng Học Từ Vựng & Luyện Viết Chữ Hán

Ứng dụng web học tiếng Trung hiện đại kết hợp phương pháp Lặp lại ngắt quãng (Spaced Repetition System - SM-2), tập viết chữ Hán theo chuẩn bút thuận trên ô Mễ tự (米字格), kiểm tra phát âm giọng nói và nhận diện thẻ từ vựng qua ảnh chụp (OCR).

- **Tác giả:** Phạm Thế Mỹ
- **Hotline / MoMo / MB Bank:** `0987830111`
- **Công nghệ:** React 19, TypeScript, Vite, Tailwind CSS v4, HanziWriter, Firebase Auth & Firestore, Web Speech API.

---

## 🚀 Hướng Dẫn Đưa Lên GitHub

### Bước 1: Khởi tạo Git & Đẩy code lên GitHub

Mở Terminal tại thư mục dự án và thực hiện các lệnh sau:

```bash
# 1. Khởi tạo Git repository (nếu chưa có)
git init

# 2. Thêm toàn bộ file vào git
git add .

# 3. Tạo commit đầu tiên
git commit -m "feat: Khoi tao du an HanziSRS hoc tieng Trung"

# 4. Đổi tên branch chính thành main
git branch -M main

# 5. Liên kết với Repository trên GitHub của bạn
# (Thay your-username và your-repo-name bằng tài khoản GitHub của bạn)
git remote add origin https://github.com/your-username/your-repo-name.git

# 6. Đẩy mã nguồn lên GitHub
git push -u origin main
```

---

## 🌐 Hướng Dẫn Deploy Lên Host Cá Nhân

Dự án được xây dựng bằng **Vite (React SPA)**, khi build sẽ tạo ra thư mục `dist/` chứa toàn bộ mã nguồn tĩnh (HTML, JS, CSS, Asset). Bạn có thể host ở bất kỳ dịch vụ nào!

### Cách 1: Deploy lên Vercel / Netlify (Khuyên dùng - Miễn phí & Cực nhanh)
1. Đăng nhập vào [Vercel](https://vercel.com) hoặc [Netlify](https://netlify.com) bằng tài khoản GitHub.
2. Chọn **"Add New Project"** -> Chọn Repository GitHub của bạn.
3. Cấu hình Build:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Bấm **"Deploy"**. Dự án sẽ chạy tự động và cấp cho bạn tên miền miễn phí dạng `ten-du-an.vercel.app` (có HTTPS). Mỗi lần bạn `git push`, web sẽ tự động cập nhật!

---

### Cách 2: Deploy lên VPS riêng (Ubuntu / Nginx)

1. **Build dự án trên máy hoặc VPS:**
   ```bash
   npm install
   npm run build
   ```
   Sau lệnh này, thư mục `dist/` sẽ xuất hiện chứa toàn bộ website.

2. **Cài đặt Nginx:**
   ```bash
   sudo apt update
   sudo apt install nginx -y
   ```

3. **Copy thư mục `dist/` vào thư mục web server:**
   ```bash
   sudo cp -r dist/* /var/www/hanzisrs/
   ```

4. **Cấu hình Nginx (`/etc/nginx/sites-available/hanzisrs`):**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       root /var/www/hanzisrs;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

5. **Kích hoạt và khởi động lại Nginx:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/hanzisrs /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

6. **Cài chứng chỉ SSL miễn phí (HTTPS):**
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

---

### Cách 3: Deploy lên Hosting dùng cPanel / DirectAdmin

1. Chạy `npm run build` trên máy tính của bạn.
2. Nén toàn bộ các file bên trong thư mục `dist/` thành file `dist.zip`.
3. Đăng nhập vào cPanel -> **File Manager** -> Mở thư mục `public_html`.
4. Upload file `dist.zip` lên và bấm **Extract** (Giải nén).
5. Tạo hoặc chỉnh sửa file `.htaccess` trong `public_html` với nội dung sau (để tránh lỗi 404 khi tải lại trang SPA):
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

---

## 🛠️ Biến Môi Trường (.env)

Tạo file `.env` nếu bạn muốn kích hoạt tính năng trích xuất OCR tự động từ hình ảnh bằng Google Gemini API:
```env
VITE_GEMINI_API_KEY="AIzaSy..."
```

---

## ☕ Ủng Hộ Tác Giả (Donation)

- **Chủ tài khoản:** PHAM THE MY
- **MB Bank:** `0987830111`
- **Ví MoMo:** `0987830111`
