// Khởi tạo Firebase
let db;
let currentTab = 'new';
let editingOrderId = null;

// Thống kê
let stats = {
    todayOrders: 0,
    todayRevenue: 0,
    pendingOrders: 0,
    totalRevenue: 0
};

// Khởi tạo OneSignal cho admin
function initOneSignalAdmin() {
    try {
        window.OneSignal = window.OneSignal || [];
        OneSignal.push(function() {
            OneSignal.init({
                appId: "c9a36149-640d-4d30-a089-e3cbea5dc1ce",
                safari_web_id: "web.onesignal.auto.18140f24-f6a2-4328-8c00-7db655b9fb0c",
                notifyButton: {
                    enable: true,
                },
                allowLocalhostAsSecureOrigin: true
            });
            
            // Đăng ký nhận thông báo cho admin
            OneSignal.showSlidedownPrompt();
        });
    } catch (error) {
        console.error('Lỗi khởi tạo OneSignal:', error);
    }
}

// Khởi tạo dashboard trực tiếp (không cần đăng nhập)
function initDashboard() {
    // Dashboard đã hiển thị sẵn trong HTML, chỉ cần tải dữ liệu
    loadDashboardData();
}

// Tải dữ liệu dashboard
async function loadDashboardData() {
    showLoading(true);
    
    try {
        await Promise.all([
            loadStats(),
            loadOrders()
        ]);
    } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
        alert('Có lỗi khi tải dữ liệu. Vui lòng tải lại trang!');
    } finally {
        showLoading(false);
    }
}

// Tải thống kê
async function loadStats() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    try {
        // Thống kê hôm nay
        const todayOrdersSnapshot = await db.collection('orders')
            .where('createdAt', '>=', startOfDay)
            .where('createdAt', '<', endOfDay)
            .get();
        
        stats.todayOrders = todayOrdersSnapshot.size;
        stats.todayRevenue = 0;
        
        todayOrdersSnapshot.forEach(doc => {
            const order = doc.data();
            if (order.status === 'paid' || order.status === 'archived') {
                stats.todayRevenue += order.totalAmount || 0;
            }
        });
        
        // Đơn chờ xử lý
        const pendingOrdersSnapshot = await db.collection('orders')
            .where('status', 'in', ['new', 'processing'])
            .get();
        
        stats.pendingOrders = pendingOrdersSnapshot.size;
        
        // Tổng doanh thu
        const allPaidOrdersSnapshot = await db.collection('orders')
            .where('status', 'in', ['paid', 'archived'])
            .get();
        
        stats.totalRevenue = 0;
        allPaidOrdersSnapshot.forEach(doc => {
            const order = doc.data();
            stats.totalRevenue += order.totalAmount || 0;
        });
        
        updateStatsDisplay();
        
    } catch (error) {
        console.error('Lỗi tải thống kê:', error);
    }
}

// Cập nhật hiển thị thống kê
function updateStatsDisplay() {
    document.getElementById('todayOrders').textContent = stats.todayOrders;
    document.getElementById('todayRevenue').textContent = formatCurrency(stats.todayRevenue);
    document.getElementById('pendingOrders').textContent = stats.pendingOrders;
    document.getElementById('totalRevenue').textContent = formatCurrency(stats.totalRevenue);
}

// Tải đơn hàng
async function loadOrders() {
    try {
        // Lấy tất cả đơn hàng, sắp xếp theo thời gian tạo mới nhất
        const ordersSnapshot = await db.collection('orders')
            .orderBy('createdAt', 'desc')
            .get();
        
        const orders = {
            new: [],
            processing: [],
            completed: [],
            paid: [],
            archived: []
        };
        
        ordersSnapshot.forEach(doc => {
            const order = { id: doc.id, ...doc.data() };
            
            // Chuyển đổi timestamp
            if (order.createdAt && order.createdAt.toDate) {
                order.createdAt = order.createdAt.toDate();
            }
            if (order.updatedAt && order.updatedAt.toDate) {
                order.updatedAt = order.updatedAt.toDate();
            }
            
            if (orders[order.status]) {
                orders[order.status].push(order);
            } else {
                console.warn(`Trạng thái không xác định: ${order.status} cho đơn hàng ${order.id}`);
            }
        });
        
        // Hiển thị đơn hàng theo tab
        displayOrdersByStatus('new', orders.new);
        displayOrdersByStatus('processing', orders.processing);
        displayOrdersByStatus('completed', orders.completed);
        displayOrdersByStatus('paid', orders.paid);
        displayOrdersByStatus('archived', orders.archived);
        
    } catch (error) {
        console.error('Lỗi tải đơn hàng:', error);
    }
}

// Hiển thị đơn hàng theo trạng thái
function displayOrdersByStatus(status, orders) {
    const containerMap = {
        'new': 'newOrdersList',
        'processing': 'processingOrdersList',
        'completed': 'completedOrdersList',
        'paid': 'paidOrdersList',
        'archived': 'historyOrdersList'
    };
    
    const container = document.getElementById(containerMap[status]);
    
    if (!container) {
        console.error(`Container không tồn tại cho status: ${status}`);
        return;
    }
    
    if (!orders || orders.length === 0) {
        const noOrdersText = {
            'new': 'Không có đơn hàng mới',
            'processing': 'Không có đơn hàng đang làm',
            'completed': 'Không có đơn hàng hoàn thành',
            'paid': 'Không có đơn hàng đã thanh toán',
            'archived': 'Không có lịch sử đơn hàng'
        };
        
        container.innerHTML = `<p class="no-orders">${noOrdersText[status]}</p>`;
        return;
    }
    
    let html = '';
    orders.forEach(order => {
        html += createOrderCard(order);
    });
    
    container.innerHTML = html;
}

// Tạo card đơn hàng
function createOrderCard(order) {
    const statusMap = {
        'new': { class: 'status-new', text: 'Đơn Mới' },
        'processing': { class: 'status-processing', text: 'Đang Làm' },
        'completed': { class: 'status-completed', text: 'Hoàn Thành' },
        'paid': { class: 'status-paid', text: 'Đã Thanh Toán' },
        'archived': { class: 'status-archived', text: 'Đã Lưu Trữ' }
    };
    
    const status = statusMap[order.status] || { class: 'status-new', text: 'Không xác định' };
    
    // Tạo danh sách món
    let itemsList = 'Không có thông tin món';
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        itemsList = order.items.map(item => {
            if (!item) return 'Món không xác định';
            let itemText = `${item.name || 'Món không tên'} x${item.quantity || 1}`;
            if (item.toppings && Array.isArray(item.toppings) && item.toppings.length > 0) {
                const toppingsText = item.toppings
                    .filter(t => t && t.name)
                    .map(t => t.name)
                    .join(', ');
                if (toppingsText) {
                    itemText += ` (${toppingsText})`;
                }
            }
            return itemText;
        }).join('<br>');
    }
    
    // Tạo nút hành động dựa trên trạng thái
    let actionButtons = '';
    switch (order.status) {
        case 'new':
            actionButtons = `
                <button class="btn-info btn-primary" onclick="changeOrderStatus('${order.id}', 'processing')">
                    <i class="fas fa-play"></i> Bắt Đầu Làm
                </button>
                <button class="btn-warning" onclick="editOrder('${order.id}')">
                    <i class="fas fa-edit"></i> Chỉnh Sửa
                </button>
                <button class="btn-danger" onclick="deleteOrder('${order.id}')">
                    <i class="fas fa-trash"></i> Xóa
                </button>
            `;
            break;
        case 'processing':
            actionButtons = `
                <button class="btn-success" onclick="changeOrderStatus('${order.id}', 'completed')">
                    <i class="fas fa-check"></i> Hoàn Thành
                </button>
                <button class="btn-warning" onclick="editOrder('${order.id}')">
                    <i class="fas fa-edit"></i> Chỉnh Sửa
                </button>
            `;
            break;
        case 'completed':
            actionButtons = `
                <button class="btn-success" onclick="changeOrderStatus('${order.id}', 'paid')">
                    <i class="fas fa-money-bill"></i> Thanh Toán
                </button>
                <button class="btn-secondary" onclick="changeOrderStatus('${order.id}', 'processing')">
                    <i class="fas fa-undo"></i> Quay Lại
                </button>
            `;
            break;
        case 'paid':
            actionButtons = `
                <button class="btn-warning" onclick="changeOrderStatus('${order.id}', 'archived')">
                    <i class="fas fa-archive"></i> Lưu Trữ
                </button>
                <button class="btn-secondary" onclick="changeOrderStatus('${order.id}', 'completed')">
                    <i class="fas fa-undo"></i> Quay Lại
                </button>
            `;
            break;
        case 'archived':
            actionButtons = `
                <button class="btn-secondary" onclick="changeOrderStatus('${order.id}', 'paid')">
                    <i class="fas fa-undo"></i> Khôi Phục
                </button>
                <button class="btn-danger" onclick="deleteOrder('${order.id}')">
                    <i class="fas fa-trash"></i> Xóa Vĩnh Viễn
                </button>
            `;
            break;
    }
    
    return `
        <div class="order-card">
            <div class="order-header">
                <div class="order-info">
                    <h4>Đơn hàng #${order.id.substring(0, 8).toUpperCase()}</h4>
                    <div class="order-meta">
                        <i class="fas fa-clock"></i> ${formatDateTime(order.createdAt)}
                    </div>
                </div>
                <div class="order-status ${status.class}">
                    ${status.text}
                </div>
            </div>
            
            <div class="order-items">
                <h5><i class="fas fa-utensils"></i> Món đã gọi:</h5>
                <div class="item-list">${itemsList}</div>
            </div>
            
            <div class="order-details">
                <div class="detail-group">
                    <strong><i class="fas fa-user"></i> Khách hàng:</strong>
                    ${order.customerName || 'Chưa có thông tin'}
                </div>
                <div class="detail-group">
                    <strong><i class="fas fa-phone"></i> Số điện thoại:</strong>
                    ${order.customerPhone || 'Chưa có thông tin'}
                </div>
                <div class="detail-group">
                    <strong><i class="fas fa-shipping-fast"></i> Hình thức:</strong>
                    ${order.serviceType === 'dine-in' ? 'Uống tại quán' : order.serviceType === 'delivery' ? 'Giao hàng' : 'Chưa xác định'}
                </div>
                ${order.customerAddress ? `
                <div class="detail-group">
                    <strong><i class="fas fa-map-marker-alt"></i> Địa chỉ:</strong>
                    ${order.customerAddress}
                </div>` : ''}
                ${order.orderNotes ? `
                <div class="detail-group">
                    <strong><i class="fas fa-sticky-note"></i> Ghi chú:</strong>
                    ${order.orderNotes}
                </div>` : ''}
            </div>
            
            <div class="order-total">
                <i class="fas fa-money-bill-wave"></i> Tổng cộng: ${formatCurrency(order.totalAmount)}
            </div>
            
            <div class="order-actions">
                ${actionButtons}
            </div>
        </div>
    `;
}

// Thay đổi trạng thái đơn hàng
async function changeOrderStatus(orderId, newStatus) {
    if (!confirm('Bạn có chắc chắn muốn thay đổi trạng thái đơn hàng này?')) {
        return;
    }
    
    showLoading(true);
    
    try {
        await db.collection('orders').doc(orderId).update({
            status: newStatus,
            updatedAt: new Date()
        });
        
        // Tải lại dữ liệu
        await loadDashboardData();
        
        showNotification('Đã cập nhật trạng thái đơn hàng thành công!');
        
    } catch (error) {
        console.error('Lỗi cập nhật trạng thái:', error);
        alert('Có lỗi khi cập nhật trạng thái đơn hàng!');
    } finally {
        showLoading(false);
    }
}

// Xóa đơn hàng
async function deleteOrder(orderId) {
    if (!confirm('Bạn có chắc chắn muốn xóa đơn hàng này? Hành động này không thể hoàn tác!')) {
        return;
    }
    
    showLoading(true);
    
    try {
        await db.collection('orders').doc(orderId).delete();
        
        // Tải lại dữ liệu
        await loadDashboardData();
        
        showNotification('Đã xóa đơn hàng thành công!');
        
    } catch (error) {
        console.error('Lỗi xóa đơn hàng:', error);
        alert('Có lỗi khi xóa đơn hàng!');
    } finally {
        showLoading(false);
    }
}

// Biến toàn cục cho việc chỉnh sửa đơn hàng
let currentEditingOrder = null;

// Chỉnh sửa đơn hàng
async function editOrder(orderId) {
    try {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            alert('Không tìm thấy đơn hàng!');
            return;
        }
        
        const order = orderDoc.data();
        editingOrderId = orderId;
        currentEditingOrder = { 
            ...order, 
            items: [...(order.items || [])],
            id: orderId
        };
        
        // Hiển thị thông tin khách hàng
        displayEditCustomerInfo(order);
        
        // Hiển thị danh sách món hiện tại
        displayEditItemsList();
        
        // Hiển thị menu để thêm món
        displayEditMenuItems();
        
        // Cập nhật tổng tiền
        updateEditTotal();
        
        // Hiển thị modal
        document.getElementById('editModal').classList.add('show');
        
    } catch (error) {
        console.error('Lỗi tải thông tin đơn hàng:', error);
        alert('Có lỗi khi tải thông tin đơn hàng!');
    }
}

// Hiển thị thông tin khách hàng trong modal chỉnh sửa
function displayEditCustomerInfo(order) {
    const customerDetails = document.getElementById('editCustomerDetails');
    customerDetails.innerHTML = `
        <div class="customer-detail-item">
            <i class="fas fa-user"></i>
            <span>${order.customerName || 'Chưa có thông tin'}</span>
        </div>
        <div class="customer-detail-item">
            <i class="fas fa-phone"></i>
            <span>${order.customerPhone || 'Chưa có thông tin'}</span>
        </div>
        <div class="customer-detail-item">
            <i class="fas fa-shipping-fast"></i>
            <span>${order.serviceType === 'dine-in' ? 'Uống tại quán' : order.serviceType === 'delivery' ? 'Giao hàng' : 'Chưa xác định'}</span>
        </div>
        ${order.customerAddress ? `
        <div class="customer-detail-item">
            <i class="fas fa-map-marker-alt"></i>
            <span>${order.customerAddress}</span>
        </div>` : ''}
        ${order.orderNotes ? `
        <div class="customer-detail-item">
            <i class="fas fa-sticky-note"></i>
            <span>${order.orderNotes}</span>
        </div>` : ''}
    `;
}

// Hiển thị danh sách món trong đơn hàng đang chỉnh sửa
function displayEditItemsList() {
    const itemsList = document.getElementById('editItemsList');
    
    if (!currentEditingOrder.items || currentEditingOrder.items.length === 0) {
        itemsList.innerHTML = '<p>Chưa có món nào trong đơn hàng</p>';
        return;
    }
    
    let html = '';
    currentEditingOrder.items.forEach((item, index) => {
        const toppingsText = item.toppings && item.toppings.length > 0 
            ? item.toppings.map(t => t.name).join(', ') 
            : '';
        
        html += `
            <div class="edit-item">
                <div class="edit-item-info">
                    <div class="edit-item-name">${item.name}</div>
                    ${toppingsText ? `<div class="edit-item-toppings">${toppingsText}</div>` : ''}
                    <div class="edit-item-price">${formatCurrency(item.price * item.quantity)}</div>
                </div>
                <div class="edit-item-controls">
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="updateItemQuantity(${index}, ${item.quantity - 1})" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
                        <span class="quantity-display">${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateItemQuantity(${index}, ${item.quantity + 1})">+</button>
                    </div>
                    <button class="remove-item-btn" onclick="removeEditItem(${index})">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </div>
            </div>
        `;
    });
    
    itemsList.innerHTML = html;
}

// Hiển thị menu để thêm món
function displayEditMenuItems() {
    const menuContainer = document.getElementById('editMenuItems');
    
    const menuItems = [
        { name: 'Trà Chanh', price: 10000 },
        { name: 'Trà Quất', price: 10000 },
        { name: 'Sữa Chua Lắc', price: 25000 },
        { name: 'Cafe Nâu', price: 20000 },
        { name: 'Cafe Đen', price: 20000 },
        { name: 'Bim Bim', price: 6000 },
        { name: 'Nước Ngọt', price: 10000 },
        { name: 'Bò Húc', price: 15000 },
        { name: 'Hướng Dương', price: 10000 }
    ];
    
    let html = '';
    menuItems.forEach(item => {
        html += `
            <div class="add-menu-item" onclick="addItemToEdit('${item.name}', ${item.price})">
                <div class="add-menu-item-name">${item.name}</div>
                <div class="add-menu-item-price">${formatCurrency(item.price)}</div>
            </div>
        `;
    });
    
    menuContainer.innerHTML = html;
}

// Thêm món vào đơn hàng đang chỉnh sửa
function addItemToEdit(itemName, itemPrice) {
    if (!currentEditingOrder.items) {
        currentEditingOrder.items = [];
    }
    
    // Kiểm tra xem món đã tồn tại chưa
    const existingItemIndex = currentEditingOrder.items.findIndex(item => 
        item.name === itemName && !item.toppings?.length
    );
    
    if (existingItemIndex >= 0) {
        // Nếu đã tồn tại, tăng số lượng
        currentEditingOrder.items[existingItemIndex].quantity += 1;
    } else {
        // Nếu chưa tồn tại, thêm món mới
        currentEditingOrder.items.push({
            name: itemName,
            price: itemPrice,
            quantity: 1,
            toppings: []
        });
    }
    
    // Cập nhật hiển thị
    displayEditItemsList();
    updateEditTotal();
}

// Cập nhật số lượng món
function updateItemQuantity(itemIndex, newQuantity) {
    if (newQuantity < 1 || !currentEditingOrder.items[itemIndex]) return;
    
    currentEditingOrder.items[itemIndex].quantity = newQuantity;
    
    displayEditItemsList();
    updateEditTotal();
}

// Xóa món khỏi đơn hàng
function removeEditItem(itemIndex) {
    if (!currentEditingOrder.items[itemIndex]) return;
    
    if (confirm('Bạn có chắc chắn muốn xóa món này?')) {
        currentEditingOrder.items.splice(itemIndex, 1);
        displayEditItemsList();
        updateEditTotal();
    }
}

// Cập nhật tổng tiền
function updateEditTotal() {
    let total = 0;
    
    if (currentEditingOrder.items) {
        currentEditingOrder.items.forEach(item => {
            total += item.price * item.quantity;
            
            if (item.toppings) {
                item.toppings.forEach(topping => {
                    total += topping.price * item.quantity;
                });
            }
        });
    }
    
    currentEditingOrder.totalAmount = total;
    document.getElementById('editOrderTotal').textContent = formatCurrency(total);
}

// Lưu chỉnh sửa đơn hàng
async function saveOrderEdit() {
    if (!editingOrderId || !currentEditingOrder) return;
    
    const updateData = {
        items: currentEditingOrder.items || [],
        totalAmount: currentEditingOrder.totalAmount || 0,
        updatedAt: new Date()
    };
    
    showLoading(true);
    
    try {
        await db.collection('orders').doc(editingOrderId).update(updateData);
        
        closeEditModal();
        await loadDashboardData();
        
        showNotification('Đã cập nhật đơn hàng thành công!');
        
    } catch (error) {
        console.error('Lỗi cập nhật đơn hàng:', error);
        alert('Có lỗi khi cập nhật đơn hàng!');
    } finally {
        showLoading(false);
    }
}

// Đóng modal chỉnh sửa
function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    editingOrderId = null;
    currentEditingOrder = null;
}

// Chuyển tab
function showTab(tabName) {
    currentTab = tabName;
    
    // Cập nhật nút tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Hiển thị nội dung tab
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const tabContentMap = {
        'new': 'newOrders',
        'processing': 'processingOrders',
        'completed': 'completedOrders',
        'paid': 'paidOrders',
        'history': 'historyOrders'
    };
    
    document.getElementById(tabContentMap[tabName]).classList.add('active');
}

// Lọc theo ngày
async function filterByDate() {
    const filterDate = document.getElementById('filterDate').value;
    if (!filterDate) {
        alert('Vui lòng chọn ngày!');
        return;
    }
    
    const selectedDate = new Date(filterDate);
    const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const endOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1);
    
    showLoading(true);
    
    try {
        const ordersSnapshot = await db.collection('orders')
            .where('createdAt', '>=', startOfDay)
            .where('createdAt', '<', endOfDay)
            .orderBy('createdAt', 'desc')
            .get();
        
        let totalRevenue = 0;
        let totalOrders = ordersSnapshot.size;
        
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            if (order.status === 'paid' || order.status === 'archived') {
                totalRevenue += order.totalAmount || 0;
            }
        });
        
        alert(`Ngày ${formatDate(selectedDate)}:\n` +
              `Tổng số đơn: ${totalOrders}\n` +
              `Doanh thu: ${formatCurrency(totalRevenue)}`);
        
    } catch (error) {
        console.error('Lỗi lọc theo ngày:', error);
        alert('Có lỗi khi lọc dữ liệu!');
    } finally {
        showLoading(false);
    }
}

// Format ngày giờ
function formatDateTime(date) {
    if (!date) return '';
    
    const d = new Date(date);
    return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Format ngày
function formatDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Format tiền tệ
function formatCurrency(amount) {
    if (!amount || isNaN(amount)) return '0đ';
    return amount.toLocaleString('vi-VN') + 'đ';
}

// Hiển thị thông báo
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.textContent = message;
    
    const backgroundColor = type === 'success' ? '#28a745' : 
                           type === 'error' ? '#dc3545' : 
                           type === 'warning' ? '#ffc107' : '#17a2b8';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${backgroundColor};
        color: ${type === 'warning' ? '#212529' : 'white'};
        padding: 1rem;
        border-radius: 5px;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Thêm CSS animation nếu chưa có
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Tự động xóa sau 4 giây
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Hiển thị/ẩn loading
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
}

// Thiết lập real-time listener cho đơn hàng mới
function setupOrderListener() {
    try {
        db.collection('orders')
            .where('status', '==', 'new')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const order = { id: change.doc.id, ...change.doc.data() };
                        
                        // Chỉ hiện thông báo nếu đơn được tạo trong vòng 30 giây qua
                        const now = new Date();
                        const orderTime = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                        
                        if ((now - orderTime) < 30000) { // 30 giây
                            showNotification(`Có đơn hàng mới từ ${order.customerName}!`, 'info');
                            
                            // Phát âm thanh thông báo (nếu có)
                            try {
                                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+H0xnoqBSl+zPLZiDYIG2m98OScTgwOUarm7blmIAU7k9n128QzBSdxx/DekUAJFFyz6eyrWBUIRZ3e9MV9KwUme8f18YYyBx5nuvDcmUoOElGk5O+7ayMGQJPY8M14JgUqi9Xy2YU2AhxdtejutmQcdSw1Z6Q19XKqZiEGOYLB8N+SQwoUXLNo66tVFAhEn+Lwwn0qBih+yPDbhzoIGGjF8+OZTR0PU6Pm8bp1LQU5hM/26YQ8CRhkwfHalEILFFyk5O6rZSAHPJNS+9N4JgUqi9Xy2YU2AhxdtejutmQcdSw1Z6Q19XKqZiEGOYLB8N+SQwoUXLNo66tVFAhEn+Lwwn0qBih+yPDbhzoIGGjF8+OZTR0PU6Pm8bp1LQU5hM/26YQ8CRhkwfHalEILFFyk5O6rZSAHPJNS+9N4JgUqi9Xy2YU2AhxdtejutmQcdSw1Z6Q19XKqZiEGOYLB8N+SQwoUXLNo66tVFAhEn+Lwwn0qBih+yPDbhzoIGGjF8+OZTR0PU6Pm8bp1LQU5hM/26YQ8CRhkwfHalEILFFyk5O6rZSAHPJNS+9N4JgUqi9Xy2YU2AhxdtejutmQcdSw1Z6Q19XKqZiEGOYLB8N+SQwoUXLNo66tVFAhEn+Lwwn0qBih+yPDbhzoIGGjF8+OZTR0PU6Pm8bp1LQU5hM/26YQ8CRhkwfHalEILFFyk5O6rZSAHPJNS+9N4JgUqi9Xy2YU2AhxdtejutmQcdSw1Z6Q19XKqZiEGOYLB8N+SQwoUXLNo66tVFAhEn+Lwwn0qBih+yPDbhzoIGGjF8+OZTR0PU6Pm8bp1LQU5hM/26YQ8CRhkwfHalEILFFyk5O6rZSAHPJNS+9N4JgUqi9Xy2YU2AhxdtejutmQcdSw1Z6Q19XKqZiEGOYLB8N+SQwoUXLNo66tVFAhEn+Lwwn0qBih+yPDbhzoIGGjF8+OZTR0PU6Pm8bp1LQU5hM/26YQ8CRhkwfHalEILFFyk5O6rZSAHPJNS+9N4JgUqi9Xy2YU2AhxdtejutmQcdSw1Z6Q19XKqZiEGOYLB8N+SQwoUXLNo66tVFAhEn+Lwwn0qBih+yPDbhzoIGGjF8+OZTR0PU6Pm8bp1LQU5hM/26YQ8CRhkwfHalEILFFyk5O6rZSAHPJNS+9N4JgU=');
                                audio.play().catch(e => console.log('Không thể phát âm thanh'));
                            } catch (e) {
                                console.log('Không hỗ trợ phát âm thanh');
                            }
                            
                            // Cập nhật lại dữ liệu
                            loadDashboardData();
                        }
                    }
                });
            }, (error) => {
                console.error('Lỗi listener đơn hàng:', error);
            });
    } catch (error) {
        console.error('Lỗi thiết lập listener:', error);
    }
}

// Khởi tạo ứng dụng admin
function initAdminApp() {
    // Kiểm tra Firebase đã sẵn sàng
    if (typeof firebase === 'undefined') {
        console.error('Firebase chưa được tải!');
        return;
    }
    
    try {
        // Khởi tạo Firebase từ config
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        // Khởi tạo Firestore
        db = firebase.firestore();
        
        console.log('Firebase Admin đã được khởi tạo thành công');
        
        // Thiết lập date picker mặc định là hôm nay
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('filterDate').value = today;
        
        // Khởi tạo OneSignal
        initOneSignalAdmin();
        
        // Khởi tạo dashboard trực tiếp
        initDashboard();
        setupOrderListener();
        
    } catch (error) {
        console.error('Lỗi khởi tạo Firebase Admin:', error);
        alert('Có lỗi khi khởi tạo ứng dụng quản trị. Vui lòng tải lại trang!');
    }
}

// Khởi tạo khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', function() {
    // Đợi Firebase config được tải
    const checkFirebaseConfig = setInterval(() => {
        if (typeof firebaseConfig !== 'undefined') {
            clearInterval(checkFirebaseConfig);
            initAdminApp();
        }
    }, 100);
    
    // Timeout sau 10 giây
    setTimeout(() => {
        clearInterval(checkFirebaseConfig);
        if (typeof firebaseConfig === 'undefined') {
            console.error('Không thể tải Firebase config');
            alert('Không thể kết nối đến cơ sở dữ liệu. Vui lòng tải lại trang!');
        }
    }, 10000);
});

// Xử lý click bên ngoài modal để đóng
document.addEventListener('click', function(e) {
    const editModal = document.getElementById('editModal');
    if (e.target === editModal) {
        closeEditModal();
    }
});

// Xử lý phím ESC để đóng modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeEditModal();
    }
});
