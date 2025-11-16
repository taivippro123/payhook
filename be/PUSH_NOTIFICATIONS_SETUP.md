# Push Notifications Setup

## Cấu hình VAPID Keys

1. Generate VAPID keys:
```bash
cd be
npx web-push generate-vapid-keys
```

2. Thêm vào `.env`:
```
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:admin@payhook.codes
```

## Cách hoạt động

1. User đăng ký push notifications qua UI
2. Khi có giao dịch mới, backend gửi push notification
3. Service Worker nhận notification và phát âm thanh
4. Hoạt động ngay cả khi đóng trình duyệt/khóa màn hình

## Lưu ý

- iOS: Chỉ hỗ trợ từ iOS 16.4+, âm thanh chỉ hoạt động với sound: "default"
- Android: Hoạt động tốt với Chrome/Firefox
- Desktop: Hoạt động tốt với Chrome/Edge/Firefox

