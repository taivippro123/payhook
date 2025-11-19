import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { RateLimitProvider } from '@/contexts/RateLimitContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import AdminDashboard from '@/pages/AdminDashboard'
import QRGenerator from '@/pages/QRGenerator'
import WebhookLogs from '@/pages/WebhookLogs'
import Guide from '@/pages/Guide'
import Home from '@/pages/Home'
import Privacy from '@/pages/Privacy'
import Notification from '@/pages/Notification'
import { getRedirectPath } from '@/utils/redirect'

function RootRedirect() {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Đang tải...</div>
      </div>
    )
  }
  
  const redirectPath = getRedirectPath(user)
  return <Navigate to={redirectPath} replace />
}

// Helper function để phát âm thanh bằng Web Speech API
function playWithSpeechSynthesis(text) {
  if ('speechSynthesis' in window) {
    // Dừng bất kỳ speech nào đang phát
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    // Tìm giọng tiếng Việt nếu có
    const voices = window.speechSynthesis.getVoices();
    const vietnameseVoice = voices.find(voice => 
      voice.lang.includes('vi') || voice.lang.includes('VN')
    );
    
    if (vietnameseVoice) {
      utterance.voice = vietnameseVoice;
      utterance.lang = 'vi-VN';
    } else {
      // Fallback về tiếng Việt nếu không tìm thấy giọng
      utterance.lang = 'vi-VN';
    }
    
    utterance.rate = 1.0; // Tốc độ đọc
    utterance.pitch = 1.0; // Cao độ
    utterance.volume = 1.0; // Âm lượng
    
    window.speechSynthesis.speak(utterance);
    console.log('🔊 Playing sound with Speech Synthesis:', text);
  }
}

function App() {
  // Audio unlock mechanism - unlock audio khi user tương tác lần đầu
  useEffect(() => {
    let audioUnlocked = false;
    
    // Unlock audio khi user tương tác (click, touch, keypress)
    const unlockAudio = async () => {
      if (audioUnlocked) return;
      
      try {
        // Tạo một audio element tạm và play/pause để unlock
        const unlockAudioEl = new Audio();
        unlockAudioEl.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURAJR6Hh8sBrJAUwgM/z1oQ4CBxqvu3knlIRCkef4fK+bCEFMYfR89OCMwYebsDv45lREAlHoeHywGskBTCAz/PWhDgIHGq+7eSeUhEKR5/h8r5sIQUxh9Hz04IzBh5uwO/jmVEQCUeh4fLAayQF';
        unlockAudioEl.volume = 0.01; // Rất nhỏ, gần như không nghe thấy
        await unlockAudioEl.play();
        unlockAudioEl.pause();
        unlockAudioEl.currentTime = 0;
        audioUnlocked = true;
        console.log('✅ Audio unlocked');
      } catch (error) {
        console.log('Audio unlock attempt:', error.message);
      }
    };
    
    // Unlock khi user tương tác
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, unlockAudio, { once: true });
    });
    
    // Store unlockAudio function globally để có thể gọi từ event handlers
    window.unlockAudioForPayhook = unlockAudio;
    
    // Lắng nghe BroadcastChannel (hoạt động ngay cả khi tab ở background)
    let broadcastChannel = null;
    try {
      broadcastChannel = new BroadcastChannel('payhook-audio');
      broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'PLAY_AUDIO_URL' && event.data.audioUrl) {
          try {
            const audio = new Audio(event.data.audioUrl);
            audio.volume = 1.0;
            audio.play().catch(error => {
              // Nếu lỗi autoplay, thử unlock và play lại
              if (error.name === 'NotAllowedError') {
                if (window.unlockAudioForPayhook) {
                  window.unlockAudioForPayhook().then(() => {
                    audio.play().catch(err => {
                      console.error('Error playing audio after unlock:', err);
                      // Fallback: sử dụng Web Speech API
                      if (event.data.text) {
                        playWithSpeechSynthesis(event.data.text);
                      }
                    });
                  });
                } else {
                  // Fallback: sử dụng Web Speech API
                  if (event.data.text) {
                    playWithSpeechSynthesis(event.data.text);
                  }
                }
              } else {
                console.error('Error playing audio from BroadcastChannel:', error);
                // Fallback: sử dụng Web Speech API
                if (event.data.text) {
                  playWithSpeechSynthesis(event.data.text);
                }
              }
            });
            console.log('🔊 Playing TTS audio from BroadcastChannel');
          } catch (error) {
            console.error('Error creating audio from BroadcastChannel:', error);
          }
        }
      };
    } catch (error) {
      console.log('BroadcastChannel not supported');
    }
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        // Lưu logs từ service worker
        if (event.data && event.data.type === 'SW_LOG') {
          const logEntry = event.data.log;
          try {
            const existingLogs = JSON.parse(localStorage.getItem('sw_logs') || '[]');
            existingLogs.push(logEntry);
            if (existingLogs.length > 100) {
              existingLogs.shift();
            }
            localStorage.setItem('sw_logs', JSON.stringify(existingLogs));
          } catch (e) {
            // Ignore
          }
          return;
        }
        
        // Phát âm thanh từ audio URL (từ TTS API)
        if (event.data && event.data.type === 'PLAY_AUDIO_URL' && event.data.audioUrl) {
          try {
            const audio = new Audio(event.data.audioUrl);
            audio.volume = 1.0;
            audio.play().catch(error => {
              // Nếu lỗi autoplay, thử unlock và play lại
              if (error.name === 'NotAllowedError') {
                if (window.unlockAudioForPayhook) {
                  window.unlockAudioForPayhook().then(() => {
                    audio.play().catch(err => {
                      console.error('Error playing audio after unlock:', err);
                      // Fallback: sử dụng Web Speech API
                      if (event.data.text) {
                        playWithSpeechSynthesis(event.data.text);
                      }
                    });
                  });
                } else {
                  // Fallback: sử dụng Web Speech API
                  if (event.data.text) {
                    playWithSpeechSynthesis(event.data.text);
                  }
                }
              } else {
                console.error('Error playing audio:', error);
                // Fallback: sử dụng Web Speech API
                if (event.data.text) {
                  playWithSpeechSynthesis(event.data.text);
                }
              }
            });
            console.log('🔊 Playing TTS audio from URL');
          } catch (error) {
            console.error('Error creating audio:', error);
            // Fallback: sử dụng Web Speech API
            if (event.data.text) {
              playWithSpeechSynthesis(event.data.text);
            }
          }
        }
        // Fallback: Phát âm thanh bằng Web Speech API nếu có text
        else if (event.data && event.data.type === 'PLAY_SOUND' && event.data.text) {
          playWithSpeechSynthesis(event.data.text);
        }
      });
    }
    
    // Load voices khi có sẵn (một số browser cần load voices)
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
      };
      
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
    
    // Cleanup
    return () => {
      if (broadcastChannel) {
        broadcastChannel.close();
      }
      // Cleanup global function
      delete window.unlockAudioForPayhook;
    };
  }, []);

  return (
    <AuthProvider>
      <RateLimitProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/qr"
            element={
              <ProtectedRoute>
                <QRGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/webhooks"
            element={
              <ProtectedRoute>
                <WebhookLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guide"
            element={
              <ProtectedRoute>
                <Guide />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notification"
            element={
              <ProtectedRoute>
                <Notification />
              </ProtectedRoute>
            }
          />
          <Route path="/app" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
      </RateLimitProvider>
    </AuthProvider>
  )
}

export default App
