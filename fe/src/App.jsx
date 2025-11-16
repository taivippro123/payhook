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

function App() {
  // Lắng nghe message từ Service Worker để phát âm thanh
  useEffect(() => {
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
              console.error('Error playing audio from BroadcastChannel:', error);
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
        // Phát âm thanh từ audio URL (từ TTS API)
        if (event.data && event.data.type === 'PLAY_AUDIO_URL' && event.data.audioUrl) {
          try {
            const audio = new Audio(event.data.audioUrl);
            audio.volume = 1.0;
            audio.play().catch(error => {
              console.error('Error playing audio:', error);
            });
            console.log('🔊 Playing TTS audio from URL');
          } catch (error) {
            console.error('Error creating audio:', error);
          }
        }
        // Fallback: Phát âm thanh bằng Web Speech API nếu có text
        else if (event.data && event.data.type === 'PLAY_SOUND' && event.data.text) {
          // Phát âm thanh bằng Web Speech API
          if ('speechSynthesis' in window) {
            // Dừng bất kỳ speech nào đang phát
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(event.data.text);
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
            console.log('🔊 Playing sound:', event.data.text);
          }
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
          <Route path="/app" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
      </RateLimitProvider>
    </AuthProvider>
  )
}

export default App
