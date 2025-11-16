import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ttsAPI } from '@/lib/api'

export default function DebugNotifications() {
  const [debugInfo, setDebugInfo] = useState({
    serviceWorkerSupported: false,
    pushSupported: false,
    notificationPermission: 'default',
    serviceWorkerRegistered: false,
    serviceWorkerState: null,
    subscription: null,
    logs: []
  })

  useEffect(() => {
    checkStatus()
    
    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        // Lưu logs từ service worker
        if (event.data && event.data.type === 'SW_LOG') {
          const logEntry = event.data.log;
          // Lưu vào localStorage để có thể xem sau
          try {
            const existingLogs = JSON.parse(localStorage.getItem('sw_logs') || '[]');
            existingLogs.push(logEntry);
            // Giữ tối đa 100 logs gần nhất
            if (existingLogs.length > 100) {
              existingLogs.shift();
            }
            localStorage.setItem('sw_logs', JSON.stringify(existingLogs));
          } catch (e) {
            console.error('Error saving SW log:', e);
          }
          
          setDebugInfo(prev => ({
            ...prev,
            logs: [...prev.logs, logEntry]
          }));
        } else {
          setDebugInfo(prev => ({
            ...prev,
            logs: [...prev.logs, {
              type: 'message',
              data: event.data,
              timestamp: new Date().toISOString()
            }]
          }));
        }
      })
      
      // Load logs từ localStorage và IndexedDB
      const loadLogs = async () => {
        try {
          const localStorageLogs = JSON.parse(localStorage.getItem('sw_logs') || '[]');
          
          let indexedDBLogs = [];
          try {
            if ('indexedDB' in window) {
              const db = await new Promise((resolve, reject) => {
                const request = indexedDB.open('payhook_logs', 1);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
                request.onupgradeneeded = (event) => {
                  const db = event.target.result;
                  if (!db.objectStoreNames.contains('logs')) {
                    const objectStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                  }
                };
              });
              
              const transaction = db.transaction(['logs'], 'readonly');
              const store = transaction.objectStore('logs');
              const index = store.index('timestamp');
              
              indexedDBLogs = await new Promise((resolve, reject) => {
                const request = index.openCursor(null, 'prev');
                const logs = [];
                request.onsuccess = (e) => {
                  const cursor = e.target.result;
                  if (cursor && logs.length < 200) {
                    logs.push(cursor.value);
                    cursor.continue();
                  } else {
                    resolve(logs);
                  }
                };
                request.onerror = () => reject(request.error);
              });
            }
          } catch (e) {
            console.error('Error loading from IndexedDB:', e);
          }
          
          const allLogs = [...localStorageLogs, ...indexedDBLogs];
          const uniqueLogs = allLogs.filter((log, index, self) => 
            index === self.findIndex(l => l.timestamp === log.timestamp && l.message === log.message)
          );
          uniqueLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          
          if (uniqueLogs.length > 0) {
            setDebugInfo(prev => ({
              ...prev,
              logs: uniqueLogs.slice(-100)
            }));
          }
        } catch (e) {
          console.error('Error loading SW logs:', e);
        }
      };
      
      loadLogs();
      
      // Polling để tự động refresh logs mỗi 2 giây
      const logInterval = setInterval(() => {
        loadLogs();
      }, 2000);
      
      return () => clearInterval(logInterval);
    }
  }, [])

  const checkStatus = async () => {
    const info = {
      serviceWorkerSupported: 'serviceWorker' in navigator,
      pushSupported: 'PushManager' in window,
      notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'not-available',
      serviceWorkerRegistered: false,
      serviceWorkerState: null,
      subscription: null,
      logs: [],
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
      isStandalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    }

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          info.serviceWorkerRegistered = true
          info.serviceWorkerState = registration.active?.state || 'none'
          
          if (registration.pushManager) {
            const subscription = await registration.pushManager.getSubscription()
            if (subscription) {
              info.subscription = {
                endpoint: subscription.endpoint,
                expirationTime: subscription.expirationTime,
                keys: {
                  p256dh: subscription.getKey('p256dh') ? 'present' : 'missing',
                  auth: subscription.getKey('auth') ? 'present' : 'missing'
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking service worker:', error)
        info.logs.push({
          type: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        })
      }
    }

    setDebugInfo(info)
  }

  const requestPermission = async () => {
    try {
      if (typeof Notification === 'undefined') {
        alert('Notification API không khả dụng. Trên iOS, bạn cần "Add to Home Screen" để sử dụng notifications.')
        return
      }
      const permission = await Notification.requestPermission()
      setDebugInfo(prev => ({
        ...prev,
        notificationPermission: permission
      }))
      alert(`Notification permission: ${permission}`)
      await checkStatus()
    } catch (error) {
      alert(`Error: ${error.message}`)
    }
  }

  const testNotification = async () => {
    try {
      if (typeof Notification === 'undefined') {
        alert('Notification API không khả dụng. Trên iOS, bạn cần "Add to Home Screen" để sử dụng notifications.')
        return
      }
      
      if (Notification.permission !== 'granted') {
        alert('Vui lòng cho phép thông báo trước')
        return
      }

      if (!('serviceWorker' in navigator)) {
        alert('Service Worker không được hỗ trợ. Trên iOS, bạn cần "Add to Home Screen".')
        return
      }

      const registration = await navigator.serviceWorker.ready
      await registration.showNotification('Test Notification', {
        body: 'Đây là thông báo test',
        icon: '/android-chrome-192x192.png',
        badge: '/android-chrome-192x192.png',
        sound: 'default',
        tag: 'test-notification',
        data: {
          amount: 10000,
          playSound: true
        }
      })
      alert('Test notification sent!')
    } catch (error) {
      alert(`Error: ${error.message}`)
    }
  }

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('Service Worker registered:', registration)
      alert('Service Worker registered!')
      await checkStatus()
    } catch (error) {
      alert(`Error: ${error.message}`)
    }
  }

  const unregisterServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.unregister()
        alert('Service Worker unregistered!')
        await checkStatus()
    } else {
        alert('No service worker found')
      }
    } catch (error) {
      alert(`Error: ${error.message}`)
    }
  }

  const refreshApp = async () => {
    try {
      // Force update service worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          // Force update
          await registration.update()
          
          // Nếu có waiting worker, skip waiting
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          }
          
          // Nếu có installing worker, đợi nó activate
          if (registration.installing) {
            await new Promise((resolve) => {
              registration.installing.addEventListener('statechange', (e) => {
                if (e.target.state === 'activated') {
                  resolve()
                }
              })
            })
          }
        }
      }
      
      // Reload logs từ localStorage
      try {
        const savedLogs = JSON.parse(localStorage.getItem('sw_logs') || '[]')
        setDebugInfo(prev => ({
          ...prev,
          logs: savedLogs.slice(-100) // Load 100 logs gần nhất
        }))
      } catch (e) {
        console.error('Error loading logs:', e)
      }
      
      // Refresh status
      await checkStatus()
      
      // Reload page sau 1 giây để apply changes
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      
      alert('Đang refresh app và service worker...')
    } catch (error) {
      console.error('Error refreshing app:', error)
      alert(`Error: ${error.message}`)
    }
  }

  const forceReloadLogs = async () => {
    try {
      // Load từ localStorage
      const localStorageLogs = JSON.parse(localStorage.getItem('sw_logs') || '[]')
      
      // Load từ IndexedDB (nếu có)
      let indexedDBLogs = []
      try {
        if ('indexedDB' in window) {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('payhook_logs', 1)
            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolve(request.result)
            request.onupgradeneeded = (event) => {
              const db = event.target.result
              if (!db.objectStoreNames.contains('logs')) {
                const objectStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true })
                objectStore.createIndex('timestamp', 'timestamp', { unique: false })
              }
            }
          })
          
          const transaction = db.transaction(['logs'], 'readonly')
          const store = transaction.objectStore('logs')
          const index = store.index('timestamp')
          
          indexedDBLogs = await new Promise((resolve, reject) => {
            const request = index.openCursor(null, 'prev') // Lấy logs mới nhất trước
            const logs = []
            request.onsuccess = (e) => {
              const cursor = e.target.result
              if (cursor && logs.length < 200) {
                logs.push(cursor.value)
                cursor.continue()
              } else {
                resolve(logs)
              }
            }
            request.onerror = () => reject(request.error)
          })
        }
      } catch (e) {
        console.error('Error loading from IndexedDB:', e)
      }
      
      // Merge và sort logs theo timestamp
      const allLogs = [...localStorageLogs, ...indexedDBLogs]
      const uniqueLogs = allLogs.filter((log, index, self) => 
        index === self.findIndex(l => l.timestamp === log.timestamp && l.message === log.message)
      )
      uniqueLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      
      setDebugInfo(prev => ({
        ...prev,
        logs: uniqueLogs.slice(-100) // Load 100 logs gần nhất
      }))
      
      alert(`Đã load ${uniqueLogs.length} logs (${localStorageLogs.length} từ localStorage, ${indexedDBLogs.length} từ IndexedDB)`)
    } catch (e) {
      console.error('Error loading logs:', e)
      alert('Lỗi khi load logs: ' + e.message)
    }
  }

  const testAudio = async () => {
    try {
      // Test với text "xin chào"
      const testText = 'xin chào';
      
      console.log('Testing TTS API with text:', testText);
      const result = await ttsAPI.test(testText);
      
      if (result.audioContent) {
        // Phát audio
        const audioUrl = `data:audio/mp3;base64,${result.audioContent}`;
        const audio = new Audio(audioUrl);
        audio.volume = 1.0;
        
        try {
          await audio.play();
          console.log('✅ Test audio played:', result.message);
          // Không cần alert vì đã phát audio
        } catch (playError) {
          // Nếu lỗi autoplay, thử unlock
          if (playError.name === 'NotAllowedError' && window.unlockAudioForPayhook) {
            await window.unlockAudioForPayhook();
            await audio.play();
            console.log('✅ Test audio played after unlock:', result.message);
          } else {
            throw playError;
          }
        }
      } else {
        alert('Không có audio content trong response');
      }
    } catch (error) {
      console.error('Error testing audio:', error);
      alert(`Lỗi: ${error.response?.data?.error || error.message}`);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Debug Notifications & Service Worker</CardTitle>
          <CardDescription>
            Kiểm tra trạng thái service worker và push notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded">
              <div className="font-semibold mb-2">Service Worker Support</div>
              <div className={debugInfo.serviceWorkerSupported ? 'text-green-600' : 'text-red-600'}>
                {debugInfo.serviceWorkerSupported ? '✅ Supported' : '❌ Not Supported'}
              </div>
            </div>
            
            <div className="p-4 border rounded">
              <div className="font-semibold mb-2">Push Support</div>
              <div className={debugInfo.pushSupported ? 'text-green-600' : 'text-red-600'}>
                {debugInfo.pushSupported ? '✅ Supported' : '❌ Not Supported'}
              </div>
            </div>
            
            <div className="p-4 border rounded">
              <div className="font-semibold mb-2">Notification Permission</div>
              <div className={
                debugInfo.notificationPermission === 'granted' ? 'text-green-600' :
                debugInfo.notificationPermission === 'denied' ? 'text-red-600' :
                'text-yellow-600'
              }>
                {debugInfo.notificationPermission}
              </div>
            </div>
            
            <div className="p-4 border rounded">
              <div className="font-semibold mb-2">Service Worker State</div>
              <div>
                {debugInfo.serviceWorkerRegistered ? (
                  <span className="text-green-600">✅ {debugInfo.serviceWorkerState}</span>
                ) : (
                  <span className="text-red-600">❌ Not Registered</span>
                )}
              </div>
            </div>
          </div>

          {debugInfo.subscription && (
            <div className="p-4 border rounded bg-gray-50">
              <div className="font-semibold mb-2">Push Subscription</div>
              <div className="text-xs font-mono break-all">
                <div>Endpoint: {debugInfo.subscription.endpoint.substring(0, 50)}...</div>
                <div>Keys: {JSON.stringify(debugInfo.subscription.keys)}</div>
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={checkStatus} variant="outline">
              🔄 Refresh Status
            </Button>
            <Button onClick={forceReloadLogs} variant="outline" className="bg-green-500 hover:bg-green-600 text-white">
              📥 Reload Logs
            </Button>
            <Button onClick={refreshApp} variant="outline" className="bg-purple-500 hover:bg-purple-600 text-white">
              🔃 Refresh App & SW
            </Button>
            <Button onClick={requestPermission}>
              Request Permission
            </Button>
            <Button onClick={testNotification} variant="outline">
              Test Notification
            </Button>
            <Button onClick={testAudio} variant="outline" className="bg-blue-500 hover:bg-blue-600 text-white">
              🔊 Test Audio (Xin chào)
            </Button>
            <Button onClick={registerServiceWorker} variant="outline">
              Register SW
            </Button>
            <Button onClick={unregisterServiceWorker} variant="outline">
              Unregister SW
            </Button>
            <Button 
              onClick={() => {
                localStorage.removeItem('sw_logs');
                setDebugInfo(prev => ({ ...prev, logs: [] }));
                alert('Logs cleared!');
              }} 
              variant="outline"
              className="text-red-600 hover:text-red-700"
            >
              Clear Logs
            </Button>
          </div>

          <div className="p-4 border rounded bg-gray-50">
            <div className="font-semibold mb-2 flex justify-between items-center">
              <span>Service Worker Logs ({debugInfo.logs.length})</span>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    const logsText = debugInfo.logs.map(log => 
                      `[${log.timestamp}] [${log.level || log.type}] ${log.message} ${JSON.stringify(log.data || {})}`
                    ).join('\n');
                    navigator.clipboard.writeText(logsText);
                    alert('Logs copied to clipboard!');
                  }}
                  variant="outline"
                  size="sm"
                >
                  Copy Logs
                </Button>
                <Button 
                  onClick={async () => {
                    try {
                      const localStorageLogs = JSON.parse(localStorage.getItem('sw_logs') || '[]');
                      let indexedDBCount = 0;
                      try {
                        if ('indexedDB' in window) {
                          const db = await new Promise((resolve, reject) => {
                            const request = indexedDB.open('payhook_logs', 1);
                            request.onerror = () => reject(request.error);
                            request.onsuccess = () => resolve(request.result);
                            request.onupgradeneeded = (event) => {
                              const db = event.target.result;
                              if (!db.objectStoreNames.contains('logs')) {
                                const objectStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
                                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                              }
                            };
                          });
                          const transaction = db.transaction(['logs'], 'readonly');
                          const store = transaction.objectStore('logs');
                          const countRequest = store.count();
                          indexedDBCount = await new Promise((resolve) => {
                            countRequest.onsuccess = () => resolve(countRequest.result);
                            countRequest.onerror = () => resolve(0);
                          });
                        }
                      } catch (e) {
                        console.error('Error counting IndexedDB logs:', e);
                      }
                      alert(`Logs:\n- localStorage: ${localStorageLogs.length}\n- IndexedDB: ${indexedDBCount}\n- Displayed: ${debugInfo.logs.length}`);
                    } catch (e) {
                      alert('Error reading logs: ' + e.message);
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  Check Storage
                </Button>
              </div>
            </div>
            {debugInfo.logs.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                <div className="text-xs space-y-1">
                  {debugInfo.logs.slice().reverse().map((log, idx) => (
                    <div 
                      key={idx} 
                      className={`font-mono p-2 rounded ${
                        log.level === 'ERROR' ? 'bg-red-100 text-red-800' :
                        log.level === 'WARN' ? 'bg-yellow-100 text-yellow-800' :
                        log.level === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                        'bg-white'
                      }`}
                    >
                      <div className="font-semibold">[{log.timestamp?.split('T')[1]?.split('.')[0] || log.timestamp}] [{log.level || log.type}]</div>
                      <div>{log.message}</div>
                      {log.data && Object.keys(log.data).length > 0 && (
                        <div className="mt-1 text-gray-600">{JSON.stringify(log.data, null, 2)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm p-4 text-center">
                No logs yet. Logs will appear here when service worker receives push notifications.
              </div>
            )}
          </div>

          {debugInfo.isIOS && !debugInfo.isStandalone && (
            <div className="p-4 border rounded bg-yellow-50 border-yellow-200">
              <div className="font-semibold mb-2 text-yellow-800">⚠️ iOS Safari Limitation</div>
              <div className="text-sm text-yellow-700 space-y-2">
                <p>iOS Safari không hỗ trợ Service Worker và Push Notifications trong trình duyệt thông thường.</p>
                <p className="font-semibold">Để sử dụng notifications trên iOS:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Tap nút Share (hình vuông với mũi tên lên)</li>
                  <li>Chọn "Add to Home Screen"</li>
                  <li>Mở app từ Home Screen</li>
                  <li>Notifications sẽ hoạt động như một app thật</li>
                </ol>
              </div>
            </div>
          )}

          {debugInfo.isStandalone && (
            <div className="p-4 border rounded bg-green-50 border-green-200">
              <div className="font-semibold mb-2 text-green-800">✅ Running as PWA</div>
              <div className="text-sm text-green-700">
                App đang chạy ở chế độ PWA (Add to Home Screen). Service Worker và Notifications sẽ hoạt động.
              </div>
            </div>
          )}

          <div className="p-4 border rounded bg-blue-50">
            <div className="font-semibold mb-2">Platform Info</div>
            <div className="text-xs">
              <div>User Agent: {navigator.userAgent}</div>
              <div>Platform: {navigator.platform}</div>
              <div>Language: {navigator.language}</div>
              <div>Is iOS: {debugInfo.isIOS ? 'Yes' : 'No'}</div>
              <div>Is Standalone (PWA): {debugInfo.isStandalone ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

