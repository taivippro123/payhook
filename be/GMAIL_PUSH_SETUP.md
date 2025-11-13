# 📧 Gmail Push Notifications Setup Guide

Hướng dẫn setup Gmail Push Notifications để thay thế IMAP polling.

## 🎯 Tổng quan

Thay vì polling Gmail mỗi giây (IMAP), hệ thống sẽ:
1. User đăng nhập bằng Google OAuth2
2. Đăng ký Gmail Push Notifications
3. Google gửi webhook khi có email mới
4. Hệ thống xử lý email và gửi webhook cho user

## 📋 Bước 1: Setup Google Cloud Project

### 1.1 Tạo Google Cloud Project

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project hiện có
3. Ghi lại **Project ID**

### 1.2 Bật APIs

1. Vào **APIs & Services** → **Library**
2. Bật các APIs sau:
   - **Gmail API**
   - **Cloud Pub/Sub API**

### 1.3 Tạo OAuth 2.0 Credentials

1. Vào **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Chọn **Web application**
4. Điền thông tin:
   - **Name**: Payhook Gmail OAuth
   - **Authorized redirect URIs**: 
     ```
     https://yourdomain.com/api/auth/google/callback
     ```
5. Lưu **Client ID** và **Client Secret**

### 1.4 Cấu hình OAuth Consent Screen

1. Vào **APIs & Services** → **OAuth consent screen**
2. Chọn **External** (hoặc Internal nếu dùng Google Workspace)
3. Điền thông tin:
   - **App name**: Payhook
   - **User support email**: your-email@example.com
   - **Developer contact**: your-email@example.com
4. Thêm **Scopes**:
   - `https://www.googleapis.com/auth/gmail.readonly`
5. Thêm **Test users** (nếu app chưa verify)

## 📋 Bước 2: Setup Pub/Sub

### 2.1 Tạo Pub/Sub Topic

1. Vào **Cloud Pub/Sub** → **Topics**
2. Click **Create Topic**
3. **Topic ID**: `gmail-notifications`
4. Click **Create**

### 2.2 Tạo Pub/Sub Subscription

1. Vào **Subscriptions**
2. Click **Create Subscription**
3. **Subscription ID**: `gmail-notifications-sub`
4. **Topic**: Chọn `gmail-notifications`
5. **Delivery type**: Push
6. **Endpoint URL**: 
   ```
   https://yourdomain.com/api/gmail/webhook
   ```
7. Click **Create**

### 2.3 Cấp quyền cho Gmail API

Gmail push sử dụng service account mặc định `gmail-api-push@system.gserviceaccount.com`. Bạn cần cấp quyền Publisher cho tài khoản này.

1. Vào **Pub/Sub** → **Topics** → chọn `gmail-notifications` → tab **Permissions**  
2. Click **Add principal**  
3. Nhập chính xác: `gmail-api-push@system.gserviceaccount.com`  
4. Role: **Pub/Sub** → **Pub/Sub Publisher**  
5. Save (Google có thể mất vài phút để áp dụng)

## 📋 Bước 3: Cấu hình Environment Variables

Thêm vào `.env`:

```env
# Google OAuth2
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback

# Google Pub/Sub
GOOGLE_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-notifications

# Backend URL (cho redirect)
# Backend URL (cho redirect)
BACKEND_URL=https://yourdomain.com
FRONTEND_URL=https://your-frontend.com

# Scheduler (tùy chọn)
GMAIL_WATCH_REFRESH_INTERVAL_MS=3600000       # Chu kỳ kiểm tra auto-renew (mặc định 1h)
GMAIL_WATCH_RENEW_THRESHOLD_MS=86400000       # Gia hạn khi còn dưới 24h
```

## 📋 Bước 4: Install Dependencies

```bash
cd payhook/be
npm install googleapis
```

## 📋 Bước 5: Test OAuth Flow

1. Frontend gọi: `GET /api/auth/google`
2. Backend trả về `authUrl`
3. User click vào `authUrl` → Google OAuth
4. User cho phép → Google redirect về `/api/auth/google/callback`
5. Backend lưu `refresh_token` và đăng ký Gmail watch

## 📋 Bước 6: Verify Webhook

1. Google sẽ gửi POST request đến `/api/gmail/webhook` khi có email mới
2. Đảm bảo endpoint này accessible từ internet
3. Test bằng cách gửi email đến Gmail đã kết nối

## 🔍 Troubleshooting

### Lỗi: "Invalid redirect URI"
- Kiểm tra `GOOGLE_REDIRECT_URI` trong `.env` khớp với OAuth credentials

### Lỗi: "No refresh token"
- Đảm bảo `prompt: 'consent'` trong OAuth flow
- User phải bấm "Allow" trên consent screen

### Lỗi: "Pub/Sub topic not found"
- Kiểm tra `GOOGLE_PUBSUB_TOPIC` format: `projects/PROJECT_ID/topics/TOPIC_NAME`
- Đảm bảo topic đã được tạo

### Webhook không nhận được
- Kiểm tra endpoint `/api/gmail/webhook` accessible từ internet
- Kiểm tra Pub/Sub subscription đã được tạo với đúng endpoint URL
- Kiểm tra logs để xem có request đến không

## 📝 Notes

- Gmail watch expiration: Gmail tự động hết hạn sau ~7 ngày. Payhook có scheduler tự gia hạn (có thể tinh chỉnh bằng biến môi trường ở trên).
- Pub/Sub message format: Google gửi base64 encoded JSON.
- Email filtering: Chỉ xử lý email từ `cake.vn` và có subject `[CAKE]`.

