// Firebase Cloud Messaging & Background Incoming Call Service Worker
// Handles background incoming call push notifications like WhatsApp / FaceTime

const SW_VERSION = '1.0.0';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push Event: Triggers when an incoming call FCM push arrives while app is minimized or closed
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      try {
        payload = { data: { text: event.data.text() } };
      } catch (err) {
        payload = {};
      }
    }
  }

  // Normalize FCM data or notification payload
  const data = payload.data || payload.notification || payload;
  const isCall = data.type === 'CALL' || data.call_id || data.callId || (data.title && data.title.toLowerCase().includes('call'));

  const callId = data.callId || data.call_id || '';
  const callerName = data.callerName || data.caller_name || 'Someone';
  const callType = (data.callType || data.call_type || 'audio').toLowerCase();
  const isVideo = callType === 'video';
  const callerPic = data.callerPic || data.caller_pic || '/icon-192.png';

  const notificationTitle = isCall 
    ? `📞 Incoming ${isVideo ? 'Video' : 'Audio'} Call`
    : (data.title || 'Meet Up Notification');

  const notificationBody = isCall
    ? `${callerName} is calling you live. Tap to answer.`
    : (data.body || 'You have a new update in Meet Up.');

  const notificationOptions = {
    body: notificationBody,
    icon: callerPic,
    badge: '/icon-192.png',
    tag: callId ? `incoming-call-${callId}` : `meetup-push-${Date.now()}`,
    renotify: true,
    requireInteraction: true, // Keep notification pinned on screen like WhatsApp incoming call
    silent: false,
    vibrate: [500, 250, 500, 250, 500, 250, 1000],
    data: {
      callId,
      callerName,
      callType,
      callerPic,
      timestamp: Date.now(),
      url: callId ? `/?incomingCallId=${callId}&action=incoming` : '/'
    },
    actions: isCall ? [
      {
        action: 'answer',
        title: '✅ Answer'
      },
      {
        action: 'reject',
        title: '❌ Decline'
      }
    ] : [
      {
        action: 'open',
        title: 'Open App'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});

// Notification Click Event: User interacts with notification or action buttons
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  const callId = notifData.callId || '';

  // If user declined the call directly from notification
  if (action === 'reject') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({
            type: 'FCM_DECLINE_CALL',
            callId
          });
        }
      })
    );
    return;
  }

  // User answered or clicked notification body to view incoming call
  const targetUrl = action === 'answer'
    ? `/?incomingCallId=${callId}&action=answer`
    : (notifData.url || `/?incomingCallId=${callId}&action=incoming`);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If a window is already open, focus it and broadcast event
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: action === 'answer' ? 'FCM_ANSWER_CALL' : 'FCM_OPEN_CALL',
            callId,
            callData: notifData
          });
          return;
        }
      }

      // If no window is currently open, launch new window with callId parameter
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Listen for messages from foreground app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CANCEL_INCOMING_NOTIFICATION') {
    const callId = event.data.callId;
    if (callId) {
      self.registration.getNotifications({ tag: `incoming-call-${callId}` }).then((notifications) => {
        notifications.forEach((n) => n.close());
      });
    }
  }
});
