# 🔐 Hướng dẫn Setup Login with Google

Hướng dẫn cập nhật Google Console để thêm tính năng Login with Google vào Payhook.

## ✅ Tận dụng OAuth Client hiện có

Bạn **KHÔNG CẦN** tạo OAuth client mới! Có thể tận dụng OAuth client đã setup cho Gmail.

## 📋 Bước 1: Cập nhật OAuth Consent Screen

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project hiện có (project đã dùng cho Gmail OAuth)
3. Vào **APIs & Services** → **OAuth consent screen**

### 1.1 Thêm Scopes mới

Trong phần **Scopes**, thêm các scopes sau (nếu chưa có):

- `openid` - OpenID Connect
- `https://www.googleapis.com/auth/userinfo.profile` - Xem thông tin profile
- `https://www.googleapis.com/auth/userinfo.email` - Xem email

**Lưu ý:** Scope `gmail.readonly` đã có sẵn, giữ nguyên.

### 1.2 Cập nhật Authorized redirect URIs

1. Vào **APIs & Services** → **Credentials**
2. Click vào OAuth 2.0 Client ID hiện có
3. Trong **Authorized redirect URIs**, thêm URI mới:

```
https://yourdomain.com/api/auth/google/login/callback
```

**Ví dụ:**
- Nếu backend URL là `https://api.payhook.com`, thêm: `https://api.payhook.com/api/auth/google/login/callback`
- Nếu backend URL là `http://localhost:3000`, thêm: `http://localhost:3000/api/auth/google/login/callback`

**Lưu ý:** URI này khác với URI của Gmail OAuth (`/api/auth/google/callback`)

## 📋 Bước 2: Cập nhật Environment Variables

Thêm vào file `.env` của backend (tùy chọn):

```env
# Google Login OAuth (tùy chọn - mặc định sẽ dùng GOOGLE_REDIRECT_URI)
GOOGLE_LOGIN_REDIRECT_URI=https://yourdomain.com/api/auth/google/login/callback
```

**Lưu ý:** Nếu không set `GOOGLE_LOGIN_REDIRECT_URI`, hệ thống sẽ tự động dùng `${BACKEND_URL}/api/auth/google/login/callback`

## 📋 Bước 3: Test Login with Google

1. Khởi động backend và frontend
2. Vào trang `/login`
3. Click nút **"Đăng nhập với Google"**
4. Chọn tài khoản Google
5. Cho phép quyền truy cập
6. Hệ thống sẽ:
   - Tự động tạo user mới nếu email chưa tồn tại
   - Đăng nhập user nếu email đã tồn tại
   - Redirect về Dashboard

## 🔍 Kiểm tra

### Kiểm tra OAuth Client

1. Vào **APIs & Services** → **Credentials**
2. Xác nhận OAuth 2.0 Client ID có:
   - ✅ Scopes: `openid`, `userinfo.profile`, `userinfo.email`, `gmail.readonly`
   - ✅ Authorized redirect URIs: 
     - `/api/auth/google/callback` (cho Gmail)
     - `/api/auth/google/login/callback` (cho Login)

### Kiểm tra Logs

Backend sẽ log:
- `✅ Google login successful for user: user@example.com` - Khi login thành công
- `❌ Google login callback error: ...` - Khi có lỗi

## 🎯 So sánh với Gmail OAuth

| Tính năng | Gmail OAuth | Login OAuth |
|-----------|-------------|-------------|
| **Mục đích** | Kết nối Gmail để đọc email | Đăng nhập vào hệ thống |
| **Scopes** | `gmail.readonly` | `openid`, `userinfo.profile`, `userinfo.email` |
| **Redirect URI** | `/api/auth/google/callback` | `/api/auth/google/login/callback` |
| **Yêu cầu** | User phải đã đăng nhập | Không yêu cầu (public) |
| **Kết quả** | Lưu refresh token vào EmailConfig | Tạo/login user và trả về JWT token |

## ⚠️ Lưu ý

1. **Cùng OAuth Client:** Cả Gmail OAuth và Login OAuth dùng chung một OAuth Client ID/Secret
2. **Khác Redirect URI:** Mỗi flow có redirect URI riêng
3. **Auto-create User:** Nếu user login với Google lần đầu, hệ thống sẽ tự động tạo tài khoản mới
4. **Username:** Username được tạo tự động từ email (phần trước @), nếu trùng sẽ thêm số

## 🐛 Troubleshooting

### Lỗi: "redirect_uri_mismatch"

- Kiểm tra redirect URI trong Google Console khớp với `GOOGLE_LOGIN_REDIRECT_URI` hoặc `${BACKEND_URL}/api/auth/google/login/callback`
- Đảm bảo không có trailing slash

### Lỗi: "access_denied"

- User đã từ chối quyền truy cập
- Kiểm tra OAuth consent screen đã được publish (nếu app chưa verify)

### Lỗi: "invalid_grant"

- Authorization code đã hết hạn (thường sau 10 phút)
- User cần login lại

## 📚 Tài liệu tham khảo

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [OpenID Connect](https://openid.net/connect/)

