// OneSignal Service Worker
// File này được yêu cầu bởi OneSignal SDK để xử lý push notifications

importScripts('https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js');

// Xử lý sự kiện push notification được nhận
self.addEventListener('push', function(event) {
    console.log('Push notification nhận được:', event);
    
    // OneSignal SDK sẽ tự động xử lý việc hiển thị notification
    // Tuy nhiên, chúng ta có thể thêm xử lý tùy chỉnh ở đây nếu cần
});

// Xử lý khi người dùng click vào notification
self.addEventListener('notificationclick', function(event) {
    console.log('Notification được click:', event);
    
    event.notification.close();
    
    // Mở trang admin khi click vào notification
    event.waitUntil(
        clients.openWindow('https://leamontea55.netlify.app/admin.html')
    );
});

// Xử lý khi service worker được cài đặt
self.addEventListener('install', function(event) {
    console.log('OneSignal Service Worker đã được cài đặt');
    self.skipWaiting();
});

// Xử lý khi service worker được kích hoạt
self.addEventListener('activate', function(event) {
    console.log('OneSignal Service Worker đã được kích hoạt');
    event.waitUntil(self.clients.claim());
});

// Xử lý background sync (nếu cần)
self.addEventListener('sync', function(event) {
    console.log('Background sync:', event);
    
    if (event.tag === 'background-sync') {
        // Xử lý đồng bộ dữ liệu trong background
        event.waitUntil(doBackgroundSync());
    }
});

// Hàm đồng bộ dữ liệu background
function doBackgroundSync() {
    return new Promise((resolve) => {
        // Thực hiện các tác vụ đồng bộ cần thiết
        console.log('Đang thực hiện background sync...');
        
        // Giả lập quá trình đồng bộ
        setTimeout(() => {
            console.log('Background sync hoàn thành');
            resolve();
        }, 1000);
    });
}

// Xử lý lỗi
self.addEventListener('error', function(event) {
    console.error('Service Worker error:', event);
});

// Xử lý lỗi unhandled rejection
self.addEventListener('unhandledrejection', function(event) {
    console.error('Service Worker unhandled rejection:', event);
});
