// Service Worker for Push Notifications
// Version: v2.1 - Fixed TTS API URL to call backend directly
const CACHE_NAME = 'payhook-v2.1';
const SW_VERSION = 'v2.1';
const NOTIFICATION_SOUND_URL = '/notification-sound.mp3';

// Function để phát âm thanh TTS trong Service Worker
// Sử dụng TTS API từ backend thay vì Google Translate TTS
async function playTTSInServiceWorker(amount) {
  try {
    if (!amount || amount === 0) {
      console.log('[SW] No amount provided for TTS');
      return;
    }

    // Lấy backend API URL
    // Service worker không thể access import.meta.env
    // Backend URL: https://payhook-taivippro123.fly.dev (từ logs và code)
    // FIXED: Gọi trực tiếp đến backend thay vì frontend URL
    const backendUrl = 'https://payhook-taivippro123.fly.dev';
    const apiUrl = `${backendUrl}/api/tts/payment-success`;

    console.log(`[SW] ${SW_VERSION} - Calling TTS API:`, apiUrl, 'with amount:', amount);

    // Gọi TTS API từ backend
    console.log('[SW] Fetching TTS API with:', {
      url: apiUrl,
      method: 'POST',
      body: JSON.stringify({ amount: amount }),
      origin: self.location.origin
    });

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: amount }),
        // Không gửi credentials vì TTS endpoint không cần
        credentials: 'omit',
      });
    } catch (fetchError) {
      console.error('[SW] Fetch error:', fetchError);
      const speechText = `Đã nhận ${formatAmountToVietnamese(amount)} đồng`;
      playTTSFallback(speechText);
      return;
    }

    console.log('[SW] TTS API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error body');
      console.error('[SW] TTS API failed:', response.status, response.statusText, errorText);
      // Fallback: sử dụng Web Speech API nếu TTS API thất bại
      const speechText = `Đã nhận ${formatAmountToVietnamese(amount)} đồng`;
      playTTSFallback(speechText);
      return;
    }

    const data = await response.json();
    
    if (!data.audioContent) {
      console.error('[SW] No audio content in TTS response');
      return;
    }

    // Tạo audio URL từ base64
    const audioUrl = `data:audio/mp3;base64,${data.audioContent}`;

    // Gửi audio URL đến tất cả clients để phát
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    
    // Gửi qua postMessage đến các clients đang mở
    if (clientList.length > 0) {
      clientList.forEach((client) => {
        client.postMessage({
          type: 'PLAY_AUDIO_URL',
          audioUrl: audioUrl,
          text: data.message || `Đã nhận ${formatAmountToVietnamese(amount)} đồng`,
        });
      });
    }
    
    // Cũng gửi qua BroadcastChannel (hoạt động ngay cả khi tab đóng)
    try {
      const channel = new BroadcastChannel('payhook-audio');
      channel.postMessage({
        type: 'PLAY_AUDIO_URL',
        audioUrl: audioUrl,
        text: data.message || `Đã nhận ${formatAmountToVietnamese(amount)} đồng`,
      });
      channel.close();
    } catch (error) {
      console.log('[SW] BroadcastChannel not supported, using postMessage only');
    }
    
    console.log('[SW] TTS audio generated and sent to clients');
    
  } catch (error) {
    console.error('[SW] Error playing TTS:', error);
    // Fallback: sử dụng Web Speech API nếu có lỗi
    if (amount) {
      const speechText = `Đã nhận ${formatAmountToVietnamese(amount)} đồng`;
      playTTSFallback(speechText);
    }
  }
}

// Fallback function sử dụng Web Speech API nếu TTS API thất bại
function playTTSFallback(text) {
  // Gửi message đến clients để phát bằng Web Speech API
  clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    if (clientList.length > 0) {
      clientList.forEach((client) => {
        client.postMessage({
          type: 'PLAY_SOUND',
          text: text,
        });
      });
    }
  });
}

// Helper function để format số tiền sang tiếng Việt
function formatAmountToVietnamese(amount) {
  if (!amount || amount === 0) return 'không';
  
  const amountStr = Math.floor(amount).toString();
  const parts = [];
  
  // Chia thành các nhóm 3 chữ số
  for (let i = amountStr.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    parts.unshift(amountStr.slice(start, i));
  }
  
  // Đọc từng nhóm
  const readGroup = (group) => {
    const num = parseInt(group);
    if (num === 0) return '';
    
    const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];
    
    if (group.length === 1) {
      return digits[num];
    } else if (group.length === 2) {
      const tensDigit = Math.floor(num / 10);
      const onesDigit = num % 10;
      
      if (tensDigit === 1) {
        if (onesDigit === 0) return 'mười';
        if (onesDigit === 5) return 'mười lăm';
        return `mười ${digits[onesDigit]}`;
      } else {
        if (onesDigit === 0) return tens[tensDigit];
        if (onesDigit === 5) return `${tens[tensDigit]} lăm`;
        if (onesDigit === 1) return `${tens[tensDigit]} mốt`;
        return `${tens[tensDigit]} ${digits[onesDigit]}`;
      }
    } else {
      const hundredsDigit = Math.floor(num / 100);
      const remainder = num % 100;
      const remainderText = remainder > 0 ? readGroup(remainder.toString().padStart(2, '0')) : '';
      
      if (hundredsDigit === 0) return remainderText;
      if (remainder === 0) return `${digits[hundredsDigit]} trăm`;
      return `${digits[hundredsDigit]} trăm ${remainderText}`;
    }
  };
  
  const units = ['', 'nghìn', 'triệu', 'tỷ'];
  let result = '';
  
  for (let i = 0; i < parts.length; i++) {
    const group = parts[i];
    const groupNum = parseInt(group);
    const unitIndex = parts.length - 1 - i;
    
    if (groupNum > 0) {
      const groupText = readGroup(group);
      const unit = units[unitIndex] ? ` ${units[unitIndex]}` : '';
      result += (result ? ' ' : '') + groupText + unit;
    }
  }
  
  return result || 'không';
}

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log(`[SW] ${SW_VERSION} - Service Worker installing...`);
  // Force activate immediately, bypass waiting
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log(`[SW] ${SW_VERSION} - Service Worker activating...`);
  event.waitUntil(
    Promise.all([
      // Cleanup old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log(`[SW] ${SW_VERSION} - Deleting old cache:`, name);
              return caches.delete(name);
            })
        );
      }),
      // Claim all clients immediately
      self.clients.claim(),
    ]).then(() => {
      console.log(`[SW] ${SW_VERSION} - Activated and ready!`);
      // Notify all clients about the update
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: SW_VERSION,
          });
        });
      });
    })
  );
});

// Push event - nhận push notification từ server
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  let notificationData = {
    title: 'Giao dịch mới',
    body: 'Bạn có giao dịch mới',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    sound: 'default', // iOS sẽ phát âm thanh mặc định
    requireInteraction: false,
    tag: 'transaction-notification',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] Push payload:', payload);
      
      notificationData = {
        title: payload.title || 'Giao dịch mới',
        body: payload.body || `Đã nhận ${payload.amount ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payload.amount) : 'giao dịch mới'}`,
        icon: payload.icon || '/android-chrome-192x192.png',
        badge: '/android-chrome-192x192.png',
        sound: payload.sound || 'default',
        requireInteraction: false,
        tag: payload.tag || 'transaction-notification',
        data: payload.data || {}
      };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
    }
  }

  // Kiểm tra settings từ payload
  const shouldPlaySound = notificationData.data?.playSound !== false;
  const shouldShowNotification = notificationData.data?.showNotification !== false;

  if (!shouldShowNotification) {
    console.log('[SW] Notification disabled by settings');
    return;
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      ...notificationData,
      // Phát âm thanh trên Android/Desktop
      vibrate: [200, 100, 200],
    }).then(() => {
      // Phát âm thanh tiếng Việt ngay trong Service Worker (hoạt động cả khi app đóng)
      if (shouldPlaySound) {
        const amount = notificationData.data?.amount;
        
        if (amount) {
          // Gọi TTS API với số tiền
          playTTSInServiceWorker(amount);
        } else {
          // Nếu không có số tiền, sử dụng fallback
          const speechText = 'Đã nhận giao dịch mới';
          playTTSFallback(speechText);
        }
        
        console.log('[SW] Notification shown, playing TTS for amount:', amount);
      }
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Nếu có window đang mở, focus vào đó và phát âm thanh
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          // Phát âm thanh khi user click vào notification
          const notificationData = event.notification.data;
          if (notificationData && notificationData.amount) {
            // Gọi TTS API với số tiền
            playTTSInServiceWorker(notificationData.amount);
          }
          return client.focus();
        }
      }
      // Nếu không có window nào, mở window mới
      if (clients.openWindow) {
        return clients.openWindow('/').then((newClient) => {
          // Phát âm thanh sau khi mở tab mới
          if (newClient) {
            setTimeout(() => {
              const notificationData = event.notification.data;
              if (notificationData && notificationData.amount) {
                // Gọi TTS API với số tiền
                playTTSInServiceWorker(notificationData.amount);
              }
            }, 1000); // Đợi tab load xong
          }
        });
      }
    })
  );
});

// Message event - nhận message từ main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

