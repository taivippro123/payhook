# Payhook – parse email giao dịch ngân hàng và bắn webhook  
_English version below_

## 👋 Giới thiệu
Payhook là dự án mã nguồn mở giúp trích xuất giao dịch ngân hàng từ email (hiện hỗ trợ CAKE by VPBank), sau đó đẩy dữ liệu thời gian thực qua Webhook và WebSocket. Mục tiêu là hỗ trợ sinh viên hoặc bất kỳ ai cần dựng luồng thanh toán tiền thật nhanh chóng mà không phải đợi ngân hàng cung cấp API chính thức.

### Tính năng chính
- **Kết nối Gmail qua OAuth**: Ủy quyền đọc email CAKE, tự động đăng ký Gmail Push Notifications.
- **Parser realtime**: Khi có email giao dịch mới, Payhook chuyển thành payload chuẩn (số tiền, thời gian, nội dung).
- **Webhook + Retry**: Gửi webhook HTTPS kèm `X-Payhook-Signature`, retry tối đa 5 lần với Fibonacci delay.
- **Dashboard trực quan**: Theo dõi Gmail đang kết nối, thời gian hết hạn push, lịch sử giao dịch & webhook log.
- **Thông báo âm thanh**: Dùng Push API + Service Worker để phát ra âm thanh thông báo tiếng Việt.

### Công nghệ
- **Frontend**: React + Vite, Zustand/Context, Tailwind UI, deploy trên **Vercel**.
- **Backend**: Node.js + Express, WebSocket, axios retry, deploy trên **Fly.io**.
- **Database**: **MongoDB Atlas**, refresh token được mã hóa AES‑256‑GCM.
- **Push & TTS**: Service Worker, Web Push API, Google TTS.

### Hạ tầng triển khai
- Domain chính: `https://www.payhook.codes`
- Frontend: Vercel
- Backend: Fly.io
- MongoDB: Atlas (IP allowlist)

### Dành cho ai?
- Sinh viên cần dự án thực tế về email parsing, webhook, real-time.
- Nhóm khởi nghiệp/side project muốn tự động nhận thanh toán bank transfer.
- Hoặc bất kỳ ai có nhu cầu sử dụng Payhook.

### Tại sao là ngân hàng Cake?
- Cake là một ngân hàng số đăng ký dễ dàng và nhanh chóng.
- Cake cung cấp email thông báo nhận tiền ngay lập tức và ổn định
- Payhook không quảng cáo Cake và cũng không thuộc Cake

---

## English Version
Payhook is an open-source project that parses bank transaction emails (currently CAKE by VPBank) and pushes normalized data via Webhook/WebSocket in near real time. It’s intended for developers or anyone who needs a quick payment automation flow before having official bank APIs.

### Highlights
- Gmail OAuth connection with push notifications.
- Transaction parser that converts CAKE emails into structured payloads.
- Secure webhook delivery with retries and signature headers.
- React dashboard showing Gmail status, push expiration, recent transactions & webhook logs.
- Push notifications + Vietnamese TTS via Service Worker.

### Tech stack & Hosting
- React/Vite frontend on **Vercel**.
- Node.js/Express backend + WebSocket on **Fly.io**.
- **MongoDB Atlas** for encrypted storage.
- Domain: `https://www.payhook.codes`

### Why CAKE bank?
- CAKE is a digital bank with a fast, easy onboarding process.
- Their incoming-transaction emails are realtime and consistent, which makes parsing reliable.
- Payhook is an independent project; it doesn’t advertise or belong to CAKE.

Feel free to fork, explore, or contribute! PRs and discussions are always welcome.

