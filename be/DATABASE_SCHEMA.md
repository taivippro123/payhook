# Database Schema

## Collections

### 1. `users`
Lưu thông tin người dùng

```javascript
{
  _id: ObjectId,
  username: String,        // Unique
  email: String,
  passwordHash: String,    // Bcrypt hash
  role: String,            // 'user' hoặc 'admin' (default: 'user')
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `username`: unique index

---

### 2. `email_configs`
Lưu cấu hình email của mỗi user

```javascript
{
  _id: ObjectId,
  userId: ObjectId,        // Reference to users._id
  email: String,           // Gmail address
  refreshToken: String,    // OAuth refresh token để gọi Gmail API
  webhookUrl: String|null, // Địa chỉ webhook nhận giao dịch
  watchHistoryId: String,  // History ID hiện tại (users.watch)
  watchExpiration: Date,   // Thời điểm Gmail hết hạn push notification (~7 ngày)
  lastSyncedAt: Date|null, // Thời điểm xử lý email gần nhất
  isActive: Boolean,       // Cho phép/khóa nhận push notification
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `userId`: index
- `userId + email`: unique compound index (một user không thể có 2 config cho cùng 1 email)

---

### 3. `transactions`
Lưu các giao dịch đã phát hiện từ email

```javascript
{
  _id: ObjectId,
  userId: ObjectId,        // Reference to users._id
  emailConfigId: ObjectId, // Reference to email_configs._id
  bank: String,            // e.g., "TPBank"
  transactionId: String,
  accountNumberMasked: String,
  accountHolder: String,
  amountVND: Number,       // Số tiền (chỉ lưu số dương)
  feeVND: Number,
  vatVND: Number,
  balanceVND: Number,
  availableBalanceVND: Number,
  description: String,
  executedAt: String,      // Thời điểm thực hiện từ email
  emailUid: String,        // Email UID từ IMAP
  emailDate: Date,         // Date của email
  detectedAt: Date,        // Thời điểm phát hiện
  createdAt: Date
}
```

**Indexes:**
- `userId`: index
- `userId + transactionId + bank`: unique compound index (tránh duplicate)
- `detectedAt`: index (để sort)

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký user mới
- `POST /api/auth/login` - Đăng nhập

### Email Configs (cần authentication)
- `GET /api/email-configs` - Lấy tất cả configs của user
- `POST /api/email-configs` - Tạo config mới
- `GET /api/email-configs/:id` - Lấy config theo ID
- `PUT /api/email-configs/:id` - Cập nhật config
- `DELETE /api/email-configs/:id` - Xóa config

### Transactions (cần authentication)
- `GET /api/transactions` - Lấy transactions của user (có pagination)

### Users (cần authentication)
- `GET /api/users` - Lấy danh sách tất cả users (admin only)
- `GET /api/users/me` - Lấy thông tin user hiện tại
- `PUT /api/users/me` - Cập nhật profile của user hiện tại
- `GET /api/users/:id` - Lấy thông tin user theo ID (admin hoặc chính user đó)
- `PUT /api/users/:id` - Cập nhật user (admin hoặc chính user đó)
- `DELETE /api/users/:id` - Xóa user (admin only)
- `PUT /api/users/:id/role` - Cập nhật role của user (chỉ admin)

### Monitor (cần authentication)
- `GET /monitor/status` - Xem trạng thái monitor
- `POST /monitor/start` - Khởi động monitor
- `POST /monitor/stop` - Dừng monitor

---

## Environment Variables

```env
MONGO_URI=mongodb://localhost:27017/payhook
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
FRONTEND_URL=http://localhost:5173  # Optional: CORS origin
```

---

## Flow

1. User đăng ký/login → nhận JWT token
2. User tạo email config → lưu vào `email_configs`
3. `MultiUserEmailMonitor` tự động load tất cả active configs và start monitoring
4. Khi phát hiện transaction mới:
   - Parse email → transaction data
   - Kiểm tra số tiền âm → bỏ qua nếu âm
   - Kiểm tra duplicate → lưu vào `transactions` nếu chưa có
5. User có thể xem transactions qua API

