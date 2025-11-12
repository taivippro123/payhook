# Tài liệu cấu hình Webhook Payhook

Tài liệu này hướng dẫn chi tiết cách cấu hình và tích hợp webhook của Payhook để đồng bộ giao dịch ngân hàng vào hệ thống riêng của bạn (POS, CRM, ERP, v.v.).

---

## 1. Tổng quan

Khi Payhook quét email ngân hàng và phát hiện giao dịch mới, hệ thống sẽ lập tức gửi một yêu cầu `POST` chứa thông tin giao dịch đến địa chỉ webhook mà bạn cấu hình. Nhờ vậy, ứng dụng của bạn có thể:

- Tự động đổi trạng thái đơn hàng sang “đã thanh toán”.
- Gửi thông báo nội bộ, kích hoạt workflow tự động.
- Đồng bộ dữ liệu giao dịch với các hệ thống kế toán/BI khác.

Payhook tích hợp cơ chế retry tối đa **3 lần** nếu webhook trả về lỗi hoặc không phản hồi.  

---

## 2. Các bước cấu hình trên Payhook

### 2.1. Trên giao diện Dashboard

1. Đăng nhập Payhook với tài khoản có quyền quản trị.  
2. Vào menu **Email Configs** → chọn cấu hình hiện có hoặc nhấn **Thêm cấu hình**.  
3. Nhập/kiểm tra các trường sau:
   - **Email**: Gmail nhận thông báo ngân hàng.
   - **App Password**: Mật khẩu ứng dụng Gmail tương ứng.
   - **Webhook URL**: Địa chỉ HTTPS của webhook nhận giao dịch (ví dụ `https://pos.example.com/webhook/payhook`).
   - **Scan Interval** (tuỳ chọn): chu kỳ quét email.
4. Nhấn **Lưu**. Kể từ lúc này, mỗi giao dịch mới đọc được từ hộp thư sẽ được gửi tới webhook.

> **Mẹo:** Khi muốn chỉnh sửa webhook, nhấn nút **Sửa** tại cấu hình tương ứng, cập nhật URL rồi lưu lại.

### 2.2. Qua API Payhook

- Tạo mới: `POST /api/email-configs`
- Cập nhật: `PUT /api/email-configs/:id`

Trong payload gửi lên API, bổ sung trường `webhookUrl` để Payhook biết địa chỉ cần gửi.

---

## 3. Thông tin yêu cầu Webhook

| Thuộc tính           | Giá trị                                                                 |
|----------------------|-------------------------------------------------------------------------|
| **Method**           | `POST`                                                                  |
| **Header**           | `Content-Type: application/json`<br>`User-Agent: Payhook/1.0`           |
| **Timeout**          | 10 giây                                                                 |
| **Retry**            | Tối đa 3 lần với backoff 1s → 2s → 4s nếu lỗi mạng hoặc không nhận mã 2xx |

### 3.1. Cấu trúc JSON gửi đi

```json
{
  "event": "transaction.detected",
  "timestamp": "2025-11-12T12:34:56.789Z",
  "transaction": {
    "_id": "6743b5e7f1d3cfa1e3b12345",
    "userId": "6720e9cbe2a7496d4b123456",
    "emailConfigId": "6720ea3de2a7496d4b654321",
    "transactionId": "FT123456789",
    "bank": "CAKE",
    "amountVND": 1500000,
    "description": "ND CK 1500000 VND",
    "emailUid": 1234,
    "emailDate": "2025-11-12T12:33:45.000Z",
    "detectedAt": "2025-11-12T12:34:56.789Z",
    "createdAt": "2025-11-12T12:34:56.789Z",
    "rawAmount": "1.500.000",
    "accountNumber": "0356882700",
    "...": "các trường bổ sung tuỳ parser ngân hàng"
  }
}
```

Ghi chú:
- Trường `transactionId` và `emailUid` có thể dùng để chống xử lý trùng.
- Một số parser sẽ thêm trường riêng (ví dụ mã tham chiếu, số dư sau giao dịch).

---

## 4. Yêu cầu phản hồi từ hệ thống nhận

| Trường hợp                         | Hành vi Payhook                                              |
|-----------------------------------|--------------------------------------------------------------|
| **HTTP 2xx** (200/201/204)        | Xem là thành công, dừng retry.                              |
| **HTTP 4xx**                      | Không retry (giả định payload không hợp lệ).                |
| **HTTP 5xx** hoặc timeout         | Retry tối đa 3 lần (1s → 2s → 4s).                          |

Ví dụ phản hồi hợp lệ:

```json
{
  "success": true
}
```

Hãy bảo đảm webhook trả lời trong vòng 10 giây. Nếu cần xử lý lâu, nên xếp công việc vào hàng đợi rồi phản hồi ngay.

---

## 5. Ví dụ code nhận webhook

```js
const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook/payhook', async (req, res) => {
  const { event, transaction } = req.body;

  if (event !== 'transaction.detected' || !transaction?.transactionId) {
    return res.status(400).json({ error: 'Payload không hợp lệ' });
  }

  const {
    transactionId,
    amountVND,
    description,
    detectedAt
  } = transaction;

  // TODO: xử lý nghiệp vụ (ví dụ: tìm đơn hàng, cập nhật trạng thái thanh toán)
  await markOrderAsPaid(transactionId, amountVND, description, detectedAt);

  return res.json({ success: true });
});

app.listen(3000, () => console.log('Webhook server listening on port 3000'));
```

---

## 6. Kiểm tra & giám sát

| Tình huống                          | Cách xử lý                                                                                        |
|------------------------------------|----------------------------------------------------------------------------------------------------|
| Không thấy webhook được gọi       | Kiểm tra cấu hình có `webhookUrl`, xem log Payhook (`multiUserEmailMonitor`) để biết lý do.       |
| Nghi ngờ bị trùng giao dịch        | Dựa vào `transactionId`, `emailUid` hoặc `detectedAt` để kiểm tra và ngăn xử lý trùng.            |
| Nhận 5xx/timeout                   | Xem log hệ thống của bạn, tối ưu thời gian xử lý, dùng queue/background job nếu cần.              |
| Muốn giả lập giao dịch             | Tạo email test giống ngân hàng gửi vào hộp thư đang monitor hoặc dùng môi trường sandbox (nếu có).|

---

## 7. Khuyến nghị bảo mật

- Sử dụng HTTPS cho webhook.  
- Xác thực nguồn gửi (ví dụ kiểm tra IP, dùng secret trong header, hoặc ký chữ ký HMAC).  
- Kiểm tra giá trị `amountVND`, đối chiếu mã đơn hàng để tránh cập nhật nhầm.  
- Ghi log chi tiết (thời gian nhận, payload, trạng thái xử lý) để dễ truy vết.

---

## 8. Liên hệ & tài nguyên

- Mã nguồn xử lý webhook: `services/webhookSender.js`, `services/multiUserEmailMonitor.js`.  
- Thắc mắc hoặc cần hỗ trợ thêm, vui lòng liên hệ đội ngũ Payhook hoặc đội phát triển nội bộ.

Chúc bạn tích hợp thành công! 💪

