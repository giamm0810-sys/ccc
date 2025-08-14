// Khởi tạo Firebase (sẽ được cấu hình trong firebase-config.js)
let db;

// Danh sách món ăn
const menuItems = [
    {
        id: 'tra-chanh',
        name: 'Trà Chanh/Trà Quất',
        price: 10000,
        toppings: [
            { name: 'Nha đam', price: 5000 }
        ]
    },
    {
        id: 'sua-chua-lac',
        name: 'Sữa Chua Lắc',
        price: 25000,
        toppings: []
    },
    {
        id: 'cafe-nau-den',
        name: 'Cafe Nâu/Đen',
        price: 20000,
        toppings: []
    },
    {
        id: 'bim-bim',
        name: 'Bim Bim',
        price: 6000,
        toppings: []
    },
    {
        id: 'nuoc-ngot',
        name: 'Nước Ngọt',
        price: 10000,
        toppings: []
    },
    {
        id: 'bo-huc',
        name: 'Bò Húc',
        price: 15000,
        toppings: []
    },
    {
        id: 'huong-duong',
        name: 'Hướng Dương',
        price: 10000,
        toppings: []
    }
];

// Giỏ hàng
let cart = [];

// Khởi tạo OneSignal
function initOneSignal() {
    try {
        window.OneSignal = window.OneSignal || [];
        OneSignal.push(function() {
            OneSignal.init({
                appId: "c9a36149-640d-4d30-a089-e3cbea5dc1ce",
                safari_web_id: "web.onesignal.auto.18140f24-f6a2-4328-8c00-7db655b9fb0c",
                notifyButton: {
                    enable: false,
                },
                allowLocalhostAsSecureOrigin: true
            });
        });
    } catch (error) {
        console.error('Lỗi khởi tạo OneSignal:', error);
    }
}

// Hiển thị menu
function displayMenu() {
    const menuGrid = document.getElementById('menuGrid');
    
    menuItems.forEach(item => {
        const menuItemDiv = document.createElement('div');
        menuItemDiv.className = 'menu-item';
        
        let toppingsHTML = '';
        if (item.toppings.length > 0) {
            toppingsHTML = `
                <div class="toppings">
                    <p><strong>Topping:</strong></p>
                    ${item.toppings.map(topping => `
                        <div class="topping-option">
                            <label>
                                <input type="checkbox" class="topping-checkbox" 
                                       data-item-id="${item.id}" 
                                       data-topping-name="${topping.name}" 
                                       data-topping-price="${topping.price}">
                                ${topping.name} (+${formatCurrency(topping.price)})
                            </label>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        menuItemDiv.innerHTML = `
            <h3>${item.name}</h3>
            <div class="price">${formatCurrency(item.price)}</div>
            ${item.toppings.length > 0 ? '<div class="topping">Có topping: ' + item.toppings.map(t => t.name).join(', ') + '</div>' : ''}
            ${toppingsHTML}
            <div class="quantity-controls">
                <button type="button" class="quantity-btn" onclick="decreaseQuantity('${item.id}')" id="decrease-${item.id}">-</button>
                <span class="quantity-display" id="quantity-${item.id}">0</span>
                <button type="button" class="quantity-btn" onclick="increaseQuantity('${item.id}')">+</button>
            </div>
            <button type="button" class="add-to-cart" onclick="addToCart('${item.id}')" id="add-${item.id}" disabled>
                <i class="fas fa-plus"></i> Thêm vào giỏ
            </button>
        `;
        
        menuGrid.appendChild(menuItemDiv);
    });
    
    updateDecreaseButtons();
}

// Tăng số lượng
function increaseQuantity(itemId) {
    const quantityElement = document.getElementById(`quantity-${itemId}`);
    let quantity = parseInt(quantityElement.textContent);
    quantity++;
    quantityElement.textContent = quantity;
    
    // Kích hoạt nút thêm vào giỏ
    document.getElementById(`add-${itemId}`).disabled = false;
    
    updateDecreaseButtons();
}

// Giảm số lượng
function decreaseQuantity(itemId) {
    const quantityElement = document.getElementById(`quantity-${itemId}`);
    let quantity = parseInt(quantityElement.textContent);
    
    if (quantity > 0) {
        quantity--;
        quantityElement.textContent = quantity;
        
        // Vô hiệu hóa nút thêm vào giỏ nếu số lượng = 0
        if (quantity === 0) {
            document.getElementById(`add-${itemId}`).disabled = true;
        }
    }
    
    updateDecreaseButtons();
}

// Cập nhật trạng thái nút giảm
function updateDecreaseButtons() {
    menuItems.forEach(item => {
        const quantity = parseInt(document.getElementById(`quantity-${item.id}`).textContent);
        const decreaseBtn = document.getElementById(`decrease-${item.id}`);
        decreaseBtn.disabled = quantity === 0;
    });
}

// Thêm món vào giỏ hàng
function addToCart(itemId) {
    const quantity = parseInt(document.getElementById(`quantity-${itemId}`).textContent);
    if (quantity === 0) return;
    
    const item = menuItems.find(item => item.id === itemId);
    const selectedToppings = [];
    
    // Lấy topping đã chọn
    const toppingCheckboxes = document.querySelectorAll(`input[data-item-id="${itemId}"][type="checkbox"]:checked`);
    toppingCheckboxes.forEach(checkbox => {
        selectedToppings.push({
            name: checkbox.dataset.toppingName,
            price: parseInt(checkbox.dataset.toppingPrice)
        });
    });
    
    // Tính giá total
    let totalPrice = item.price;
    selectedToppings.forEach(topping => {
        totalPrice += topping.price;
    });
    
    // Thêm vào giỏ hàng
    const cartItem = {
        id: itemId + '-' + Date.now(), // ID duy nhất cho mỗi item trong giỏ
        itemId: itemId,
        name: item.name,
        basePrice: item.price,
        quantity: quantity,
        toppings: selectedToppings,
        totalPrice: totalPrice * quantity
    };
    
    cart.push(cartItem);
    
    // Reset form
    document.getElementById(`quantity-${itemId}`).textContent = '0';
    document.getElementById(`add-${itemId}`).disabled = true;
    toppingCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    updateDecreaseButtons();
    displayCart();
    
    // Hiệu ứng thông báo
    showNotification('Đã thêm ' + item.name + ' vào giỏ hàng!');
}

// Hiển thị giỏ hàng
function displayCart() {
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalElement = document.getElementById('cartTotal');
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Giỏ hàng trống</p>';
        cartTotalElement.textContent = '0';
        return;
    }
    
    let html = '';
    let total = 0;
    
    cart.forEach(cartItem => {
        total += cartItem.totalPrice;
        
        let toppingsText = '';
        if (cartItem.toppings.length > 0) {
            toppingsText = cartItem.toppings.map(t => t.name).join(', ');
        }
        
        html += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${cartItem.name}</div>
                    <div class="cart-item-details">
                        Số lượng: ${cartItem.quantity}
                        ${toppingsText ? `<br>Topping: ${toppingsText}` : ''}
                    </div>
                </div>
                <div class="cart-item-price">${formatCurrency(cartItem.totalPrice)}</div>
                <button type="button" class="remove-item" onclick="removeFromCart('${cartItem.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    
    cartItemsContainer.innerHTML = html;
    cartTotalElement.textContent = formatCurrency(total);
}

// Xóa món khỏi giỏ hàng
function removeFromCart(cartItemId) {
    cart = cart.filter(item => item.id !== cartItemId);
    displayCart();
    showNotification('Đã xóa món khỏi giỏ hàng!');
}

// Format tiền tệ
function formatCurrency(amount) {
    return amount.toLocaleString('vi-VN') + 'đ';
}

// Hiển thị thông báo
function showNotification(message) {
    // Tạo thông báo toast đơn giản
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 1rem;
        border-radius: 5px;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
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
    
    // Tự động xóa sau 3 giây
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Xử lý form đặt hàng
function handleOrderForm() {
    const orderForm = document.getElementById('orderForm');
    const serviceTypeInputs = document.querySelectorAll('input[name="serviceType"]');
    const addressGroup = document.getElementById('addressGroup');
    
    // Hiển thị/ẩn địa chỉ giao hàng
    serviceTypeInputs.forEach(input => {
        input.addEventListener('change', function() {
            if (this.value === 'delivery') {
                addressGroup.style.display = 'block';
                document.getElementById('customerAddress').required = true;
            } else {
                addressGroup.style.display = 'none';
                document.getElementById('customerAddress').required = false;
            }
        });
    });
    
    // Xử lý submit form
    orderForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (cart.length === 0) {
            alert('Vui lòng chọn món trước khi đặt hàng!');
            return;
        }
        
        const formData = new FormData(this);
        const orderData = {
            customerName: formData.get('customerName'),
            customerPhone: formData.get('customerPhone'),
            serviceType: formData.get('serviceType'),
            customerAddress: formData.get('customerAddress') || '',
            orderNotes: formData.get('orderNotes') || '',
            items: cart,
            totalAmount: cart.reduce((sum, item) => sum + item.totalPrice, 0),
            status: 'new',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        submitOrder(orderData);
    });
}

// Gửi đơn hàng lên Firestore
async function submitOrder(orderData) {
    showLoading(true);
    
    try {
        // Thêm đơn hàng vào Firestore
        const docRef = await db.collection('orders').add(orderData);
        
        // Thông báo đặt hàng thành công (bỏ push notification vì cần API key)
        console.log('Đơn hàng đã được lưu với ID:', docRef.id);
        
        // Hiển thị modal thành công
        showSuccessModal(docRef.id);
        
        // Reset form và giỏ hàng
        resetOrderForm();
        
    } catch (error) {
        console.error('Lỗi khi đặt hàng:', error);
        alert('Có lỗi xảy ra khi đặt hàng. Vui lòng thử lại!');
    } finally {
        showLoading(false);
    }
}

// Hàm gửi thông báo đẩy (cần cấu hình API key riêng)
async function sendPushNotification(orderData, orderId) {
    // Tạm thời bỏ qua push notification vì cần API key của OneSignal
    console.log('Thông báo đẩy:', `Đơn hàng mới từ ${orderData.customerName} - ${formatCurrency(orderData.totalAmount)}`);
}

// Hiển thị modal thành công
function showSuccessModal(orderId) {
    const modal = document.getElementById('successModal');
    const orderIdDisplay = document.getElementById('orderIdDisplay');
    
    orderIdDisplay.textContent = orderId.substring(0, 8).toUpperCase();
    modal.classList.add('show');
}

// Đóng modal
function closeModal() {
    const modal = document.getElementById('successModal');
    modal.classList.remove('show');
}

// Reset form đặt hàng
function resetOrderForm() {
    document.getElementById('orderForm').reset();
    cart = [];
    displayCart();
    
    // Reset số lượng trong menu
    menuItems.forEach(item => {
        document.getElementById(`quantity-${item.id}`).textContent = '0';
        document.getElementById(`add-${item.id}`).disabled = true;
        
        // Reset topping checkboxes
        const toppingCheckboxes = document.querySelectorAll(`input[data-item-id="${item.id}"][type="checkbox"]`);
        toppingCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    });
    
    updateDecreaseButtons();
    
    // Ẩn địa chỉ giao hàng
    document.getElementById('addressGroup').style.display = 'none';
    document.querySelector('input[value="dine-in"]').checked = true;
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

// Khởi tạo ứng dụng
function initApp() {
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
        
        console.log('Firebase đã được khởi tạo thành công');
        
        // Hiển thị menu
        displayMenu();
        
        // Xử lý form đặt hàng
        handleOrderForm();
        
        // Khởi tạo OneSignal
        initOneSignal();
        
    } catch (error) {
        console.error('Lỗi khởi tạo Firebase:', error);
        alert('Có lỗi khi khởi tạo ứng dụng. Vui lòng tải lại trang!');
    }
}

// Khởi tạo khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', function() {
    // Đợi Firebase config được tải
    const checkFirebaseConfig = setInterval(() => {
        if (typeof firebaseConfig !== 'undefined') {
            clearInterval(checkFirebaseConfig);
            initApp();
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
    const modal = document.getElementById('successModal');
    if (e.target === modal) {
        closeModal();
    }
});

// Xử lý phím ESC để đóng modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
});
