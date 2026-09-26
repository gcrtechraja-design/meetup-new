import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CallProvider, useCall } from './context/CallContext';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { DiscoveryFeed } from './components/DiscoveryFeed';
import { RecentsView } from './components/RecentsView';
import { ProfileView } from './components/ProfileView';
import { ListenerProfileModal } from './components/ListenerProfileModal';
import { ReportBlockModal } from './components/ReportBlockModal';
import { WalletModal } from './components/WalletModal';
import { TransactionsModal } from './components/TransactionsModal';
import { LanguageSwitcherModal } from './components/LanguageSwitcherModal';
import { ListenerApplicationModal } from './components/ListenerApplicationModal';
import { LegalModals } from './components/LegalModals';
import { AdminDashboard } from './components/AdminDashboard';
import { OwnerDashboard } from './components/OwnerDashboard';
import { OwnerLoginPage } from './components/OwnerLoginPage';
import { AuthModal } from './components/AuthModal';
import { LoginPage } from './components/LoginPage';
import { IncomingCallModal } from './components/IncomingCallModal';
import { OutgoingCallModal } from './components/OutgoingCallModal';
import { CallScreen } from './components/CallScreen';
import { ZegoConfigModal } from './components/ZegoConfigModal';
import { UserProfile } from './types';

const MainApp: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const { initiateCall, isInCall } = useCall();

  // Route path synchronization
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [showOwner, setShowOwner] = useState(false);

  // Handle browser back / forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Authentication Guard:
  // Check if user is logged in (localStorage & currentUser).
  // If not logged in, redirect to Login page immediately.
  // Do not allow access to Home, Matches, Chat, or any other page without login.
  // Keep the user on Login page until they login with demo number.
  const isUserLoggedIn = !!currentUser || !!localStorage.getItem('meetup_active_user_uid');

  useEffect(() => {
    if (loading) return;

    if (!isUserLoggedIn) {
      if (window.location.pathname !== '/login' && window.location.pathname !== '/owner-login') {
        window.history.replaceState({}, '', '/login');
        setCurrentPath('/login');
      }
    } else {
      if (window.location.pathname === '/login') {
        window.history.replaceState({}, '', '/');
        setCurrentPath('/');
      }
    }
  }, [isUserLoggedIn, loading]);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  // Modals
  const [showWallet, setShowWallet] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showListenerApply, setShowListenerApply] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showZegoConfig, setShowZegoConfig] = useState(false);
  const [legalType, setLegalType] = useState<'terms' | 'privacy' | 'help' | null>(null);

  // Selected User for Profile Modal or Report/Block
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [reportingUser, setReportingUser] = useState<UserProfile | null>(null);

  // Call Initiation with Coin Balance Check
  const handleVoiceCall = async (user: UserProfile) => {
    if (!currentUser) {
      setShowAuth(true);
      return;
    }
    const rate = user.voice_rate || 20;
    if (currentUser.coins_balance < rate) {
      alert(`You need at least ${rate} coins to start a voice call. Your balance is ${currentUser.coins_balance} coins.`);
      setShowWallet(true);
      return;
    }

    const res = await initiateCall(user, 'voice');
    if (!res.success && res.error) {
      alert(res.error);
      if (res.error.toLowerCase().includes('coin') || res.error.toLowerCase().includes('balance')) {
        setShowWallet(true);
      }
    }
  };

  const handleVideoCall = async (user: UserProfile) => {
    if (!currentUser) {
      setShowAuth(true);
      return;
    }
    const rate = user.video_rate || 50;
    if (currentUser.coins_balance < rate) {
      alert(`You need at least ${rate} coins to start a video call. Your balance is ${currentUser.coins_balance} coins.`);
      setShowWallet(true);
      return;
    }

    const res = await initiateCall(user, 'video');
    if (!res.success && res.error) {
      alert(res.error);
      if (res.error.toLowerCase().includes('coin') || res.error.toLowerCase().includes('balance')) {
        setShowWallet(true);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0E] flex flex-col items-center justify-center space-y-4">
        <div className="flex items-center">
          <span className="text-3xl font-black tracking-tight text-white flex items-center">
            Meet Up
            <span className="inline-block w-3 h-3 ml-2 rounded-full bg-[#FF69B4] shadow-[0_0_12px_#FF69B4] animate-ping"></span>
          </span>
        </div>
        <p className="text-xs text-zinc-500 font-medium">Connecting to Firestore & Auth...</p>
      </div>
    );
  }

  // Route protection & Owner portal:
  if (currentPath === '/owner-login') {
    const isOwnerAuthed = localStorage.getItem('meetup_owner_authenticated') === 'true' || sessionStorage.getItem('meetup_owner_token') === 'active';
    if (isOwnerAuthed) {
      return (
        <OwnerDashboard
          onClose={() => {
            window.history.pushState({}, '', '/');
            setCurrentPath('/');
          }}
          onLogoutOwner={() => {
            localStorage.removeItem('meetup_owner_authenticated');
            sessionStorage.removeItem('meetup_owner_token');
            window.history.pushState({}, '', '/owner-login');
            setCurrentPath('/owner-login');
          }}
        />
      );
    }
    return (
      <OwnerLoginPage
        onOwnerSuccess={() => {
          setShowOwner(true);
          window.history.pushState({}, '', '/owner-login');
          setCurrentPath('/owner-login');
        }}
        onNavigateHome={() => {
          window.history.pushState({}, '', '/');
          setCurrentPath('/');
        }}
      />
    );
  }

  // Strict Authentication Guard:
  // If user is not logged in (via AuthContext or localStorage), render LoginPage immediately.
  // Do not allow access to Home, Matches, Chat, Profile, or any other page without login.
  // Keep the user on Login page until they login with demo number or credentials.
  if (!isUserLoggedIn) {
    return (
      <LoginPage
        onLoginSuccess={() => {
          window.history.replaceState({}, '', '/');
          setCurrentPath('/');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] flex justify-center text-white selection:bg-[#ff4d8d]/30 selection:text-[#ff4d8d]">
      {/* Mobile-first centered frame on desktop, 100% width on mobile */}
      <div className="w-full max-w-md bg-[#0f0f1a] min-h-screen relative flex flex-col shadow-2xl border-x border-[#1e1e2d]">
        {/* Header with Logo and Live Coin Balance */}
        <Header
          onOpenWallet={() => (currentUser ? setShowWallet(true) : setShowAuth(true))}
          onOpenAdmin={() => setShowAdmin(true)}
          onOpenOwner={() => setShowOwner(true)}
        />

        {/* Main View Body */}
        <main className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'home' && (
            <DiscoveryFeed
              onVoiceCall={handleVoiceCall}
              onVideoCall={handleVideoCall}
              onOpenProfile={(u) => setSelectedUser(u)}
              onOpenReportBlock={(u) => setReportingUser(u)}
            />
          )}

          {activeTab === 'recents' && (
            <RecentsView
              onVoiceCall={handleVoiceCall}
              onVideoCall={handleVideoCall}
              onOpenProfile={(u) => setSelectedUser(u)}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              onOpenWallet={() => (currentUser ? setShowWallet(true) : setShowAuth(true))}
              onOpenTransactions={() => setShowTransactions(true)}
              onOpenLanguage={() => setShowLanguage(true)}
              onOpenListenerApply={() => setShowListenerApply(true)}
              onOpenTerms={() => setLegalType('terms')}
              onOpenPrivacy={() => setLegalType('privacy')}
              onOpenHelp={() => setLegalType('help')}
              onOpenZegoConfig={() => setShowZegoConfig(true)}
              onOpenAdmin={() => setShowAdmin(true)}
              onOpenOwner={() => setShowOwner(true)}
              onOpenAuth={() => setShowAuth(true)}
              onVoiceCall={handleVoiceCall}
              onVideoCall={handleVideoCall}
              onOpenProfile={(u) => setSelectedUser(u)}
            />
          )}
        </main>

        {/* Fixed Bottom Navigation */}
        <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />

        {/* Incoming Call Ringing Modal */}
        <IncomingCallModal />

        {/* Outgoing Call Waiting / Ringing Modal */}
        <OutgoingCallModal />

        {/* Active Call Full Screen (ZEGOCLOUD + WebRTC) */}
        {isInCall && <CallScreen />}

        {/* Modals */}
        {selectedUser && (
          <ListenerProfileModal
            user={selectedUser}
            isFavorited={false}
            onToggleFavorite={() => {}}
            onVoiceCall={handleVoiceCall}
            onVideoCall={handleVideoCall}
            onClose={() => setSelectedUser(null)}
          />
        )}

        {reportingUser && (
          <ReportBlockModal
            targetUser={reportingUser}
            onClose={() => setReportingUser(null)}
            onUserBlocked={() => {
              setReportingUser(null);
            }}
          />
        )}

        {showWallet && (
          <WalletModal onClose={() => setShowWallet(false)} />
        )}

        {showTransactions && (
          <TransactionsModal onClose={() => setShowTransactions(false)} />
        )}

        {showLanguage && (
          <LanguageSwitcherModal onClose={() => setShowLanguage(false)} />
        )}

        {showListenerApply && (
          <ListenerApplicationModal onClose={() => setShowListenerApply(false)} />
        )}

        {legalType && (
          <LegalModals type={legalType} onClose={() => setLegalType(null)} />
        )}

        {showAdmin && (
          <AdminDashboard onClose={() => setShowAdmin(false)} />
        )}

        {showOwner && (
          <OwnerDashboard
            onClose={() => setShowOwner(false)}
            onLogoutOwner={() => {
              localStorage.removeItem('meetup_owner_authenticated');
              sessionStorage.removeItem('meetup_owner_token');
              setShowOwner(false);
            }}
          />
        )}

        {showZegoConfig && (
          <ZegoConfigModal onClose={() => setShowZegoConfig(false)} />
        )}

        <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CallProvider>
        <MainApp />
      </CallProvider>
    </AuthProvider>
  );
}
