// Service Worker for Push Notifications
// Version: v2.3 - Added IndexedDB logging for iOS (works even when app is closed)
const CACHE_NAME = 'payhook-v2.3';
const SW_VERSION = 'v2.3';
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

    // Phát audio trực tiếp trong Service Worker bằng Web Audio API
    // Service Worker không bị giới hạn bởi autoplay policy
    try {
      await playAudioInServiceWorker(data.audioContent);
      logToStorage('SUCCESS', 'Audio played in Service Worker', { amount });
    } catch (audioError) {
      logToStorage('ERROR', 'Error playing audio in SW, falling back', { 
        error: audioError.message,
        amount 
      });
      
      // Fallback: Gửi audio URL đến clients nếu phát trong SW thất bại
      const audioUrl = `data:audio/mp3;base64,${data.audioContent}`;
      const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      
      if (clientList.length > 0) {
        clientList.forEach((client) => {
          client.postMessage({
            type: 'PLAY_AUDIO_URL',
            audioUrl: audioUrl,
            text: data.message || `Đã nhận ${formatAmountToVietnamese(amount)} đồng`,
          });
        });
      }
      
      // Cũng gửi qua BroadcastChannel
      try {
        const channel = new BroadcastChannel('payhook-audio');
        channel.postMessage({
          type: 'PLAY_AUDIO_URL',
          audioUrl: audioUrl,
          text: data.message || `Đã nhận ${formatAmountToVietnamese(amount)} đồng`,
        });
        channel.close();
      } catch (error) {
        console.log('[SW] BroadcastChannel not supported');
      }
    }
    
  } catch (error) {
    console.error('[SW] Error playing TTS:', error);
    // Fallback: sử dụng Web Speech API nếu có lỗi
    if (amount) {
      const speechText = `Đã nhận ${formatAmountToVietnamese(amount)} đồng`;
      playTTSFallback(speechText);
    }
  }
}

// Function để phát audio trong Service Worker
// Service Worker không hỗ trợ AudioContext, nên sử dụng Web Speech API hoặc gửi đến client
async function playAudioInServiceWorker(base64Audio) {
  // Service Worker không có AudioContext, nên không thể phát audio trực tiếp
  // Sẽ fallback về cách gửi đến client
  throw new Error('Service Worker không hỗ trợ AudioContext');
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

// Helper function để lưu logs vào IndexedDB (hoạt động cả khi không có clients)
async function saveLogToIndexedDB(logEntry) {
  try {
    // Mở IndexedDB
    const dbName = 'payhook_logs';
    const dbVersion = 1;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      
      request.onerror = () => {
        console.error('[SW] IndexedDB open error:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['logs'], 'readwrite');
        const store = transaction.objectStore('logs');
        
        // Thêm log
        const addRequest = store.add(logEntry);
        
        addRequest.onsuccess = () => {
          // Giữ tối đa 200 logs
          const countRequest = store.count();
          countRequest.onsuccess = () => {
            if (countRequest.result > 200) {
              // Xóa logs cũ
              const deleteRequest = store.openCursor();
              deleteRequest.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                  if (countRequest.result - cursor.key > 200) {
                    cursor.delete();
                  }
                  cursor.continue();
                }
              };
            }
          };
          resolve();
        };
        
        addRequest.onerror = () => {
          console.error('[SW] Error adding log to IndexedDB:', addRequest.error);
          reject(addRequest.error);
        };
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('logs')) {
          const objectStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  } catch (e) {
    console.error('[SW] Error in saveLogToIndexedDB:', e);
    return Promise.reject(e);
  }
}

// Helper function để log và lưu vào storage (để debug trên iOS)
function logToStorage(level, message, data = {}) {
  const logEntry = {
    level,
    message,
    data,
    timestamp: new Date().toISOString(),
    version: SW_VERSION
  };
  
  console.log(`[SW] ${SW_VERSION} [${level}]`, message, data);
  
  // Lưu vào IndexedDB trước (hoạt động cả khi không có clients)
  saveLogToIndexedDB(logEntry).catch(e => {
    console.error('[SW] Failed to save log to IndexedDB:', e);
  });
  
  // Cũng gửi đến clients để lưu vào localStorage (backup)
  try {
    self.clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then(clients => {
      if (clients.length > 0) {
        clients.forEach(client => {
          try {
            client.postMessage({
              type: 'SW_LOG',
              log: logEntry
            });
          } catch (e) {
            console.error('[SW] Error sending log to client:', e);
          }
        });
      }
    }).catch(e => {
      console.error('[SW] Error matching clients:', e);
    });
  } catch (e) {
    console.error('[SW] Error in logToStorage:', e);
  }
}

// Push event - nhận push notification từ server
self.addEventListener('push', (event) => {
  logToStorage('INFO', 'Push notification received', {
    hasData: !!event.data,
    dataType: event.data ? event.data.type : 'none',
    userAgent: navigator.userAgent,
    platform: navigator.platform
  });
  
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
      logToStorage('INFO', 'Push payload parsed', {
        title: payload.title,
        body: payload.body,
        amount: payload.amount,
        data: payload.data
      });
      
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
      
      // Log chi tiết về data
      logToStorage('INFO', 'Notification data extracted', {
        amount: notificationData.data?.amount,
        playSound: notificationData.data?.playSound,
        showNotification: notificationData.data?.showNotification,
        transactionId: notificationData.data?.transactionId
      });
    } catch (e) {
      logToStorage('ERROR', 'Error parsing push data', { error: e.message, stack: e.stack });
    }
  } else {
    logToStorage('WARN', 'Push event has no data');
  }

  // Kiểm tra settings từ payload
  const shouldPlaySound = notificationData.data?.playSound !== false;
  const shouldShowNotification = notificationData.data?.showNotification !== false;

  logToStorage('INFO', 'Notification settings check', {
    shouldPlaySound,
    shouldShowNotification,
    data: notificationData.data
  });

  if (!shouldShowNotification) {
    logToStorage('WARN', 'Notification disabled by settings');
    return;
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      ...notificationData,
      // Phát âm thanh trên Android/Desktop
      vibrate: [200, 100, 200],
    }).then(() => {
      console.log(`[SW] ${SW_VERSION} - Notification shown successfully:`, {
        title: notificationData.title,
        body: notificationData.body,
        amount: notificationData.data?.amount,
        shouldPlaySound,
        platform: navigator.platform,
        userAgent: navigator.userAgent
      });
      
      // Phát âm thanh tiếng Việt ngay trong Service Worker (hoạt động cả khi app đóng)
      if (shouldPlaySound) {
        const amount = notificationData.data?.amount;
        
        logToStorage('INFO', 'Attempting to play TTS', {
          amount,
          hasAmount: !!amount,
          amountType: typeof amount
        });
        
        if (amount) {
          // Gọi TTS API với số tiền
          logToStorage('INFO', 'Calling TTS API', { amount });
          playTTSInServiceWorker(amount).catch(error => {
            logToStorage('ERROR', 'TTS API failed', { error: error.message, amount });
          });
        } else {
          logToStorage('WARN', 'No amount in notification data, using fallback');
          // Nếu không có số tiền, sử dụng fallback
          const speechText = 'Đã nhận giao dịch mới';
          playTTSFallback(speechText);
        }
      } else {
        logToStorage('INFO', 'Sound disabled by settings');
      }
    }).catch((error) => {
      console.error(`[SW] ${SW_VERSION} - Error showing notification:`, error);
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

