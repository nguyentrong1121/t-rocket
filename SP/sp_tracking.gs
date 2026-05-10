// ==========================================
// CẤU HÌNH TELEGRAM
// ==========================================

var TELEGRAM_CONFIG_SP = {
    get BOT_TOKEN() { return getConfigValue('BOT_TOKEN') || ''; },
    get API_URL() { return 'https://api.telegram.org/bot' + this.BOT_TOKEN; },
    get CHAT_ID() { return getConfigValue('BOT_CHAT_ID') || ''; },
    get ENABLED() {
        var v = getConfigValue('BOT_ENABLED');
        return v === null ? true : v === true || v === 'TRUE';
    }
};

/**
 * Gửi thông báo Telegram
 */
function sendTelegramNotificationSP(text) {
    if (!TELEGRAM_CONFIG_SP.ENABLED) return false;

    var apiUrl = TELEGRAM_CONFIG_SP.API_URL + '/sendMessage';
    var payload = {
        chat_id: TELEGRAM_CONFIG_SP.CHAT_ID,
        text: text
    };

    var options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    try {
        UrlFetchApp.fetch(apiUrl, options);
        return true;
    } catch (e) {
        console.error('Failed to send Telegram reply: ' + e.toString());
        return false;
    }
}

// ==========================================
// API HELPERS
// ==========================================

/**
 * Lấy thông tin tracking từ SPX API
 */
function fetchSPXTrackingInfo(trackingNumber) {
    var url = "https://spx.vn/shipment/order/open/order/get_order_info?spx_tn=" + trackingNumber + "&language_code=vi";

    var options = {
        method: "get",
        headers: {
            "accept": "application/json, text/plain, */*",
            "accept-language": "vi,vi-VN;q=0.9,en-US;q=0.8,en;q=0.7",
            "cache-control": "no-cache",
            "cookie": "_ga=GA1.1.16968198.1768118824; _fbp=fb.1.1768118824516.901379557144810561; _gcl_au=1.1.1436420223.1778439107; _ga_0LFKSTZTGT=GS2.1.s1778439107$o3$g0$t1778439107$j60$l0$h0",
            "pragma": "no-cache",
            "priority": "u=1, i",
            "referer": "https://spx.vn/track?" + trackingNumber,
            "sec-ch-ua": "\"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
        },
        muteHttpExceptions: true
    };

    try {
        var response = UrlFetchApp.fetch(url, options);
        var json = JSON.parse(response.getContentText());

        if (json && json.retcode === 0 && json.data && json.data.sls_tracking_info && json.data.sls_tracking_info.records && json.data.sls_tracking_info.records.length > 0) {
            return json.data.sls_tracking_info.records[0];
        }
    } catch (e) {
        console.error("Lỗi khi lấy thông tin tracking SPX: " + e.toString());
    }

    return null;
}

/**
 * Format timestamp to Date string
 */
function formatTimestamp(unixTime) {
    if (!unixTime) return "";
    var date = new Date(unixTime * 1000);
    return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// ==========================================
// MAIN FUNCTION
// ==========================================

/**
 * Sync tracking status for all eligible rows in sheet SP
 */
function syncTrackingStatus() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME); // SHEET_NAME defined in sp.gs

    if (!sheet) {
        console.error("Không tìm thấy sheet: " + SHEET_NAME);
        return;
    }

    var headers = getColumnNames(sheet); // getColumnNames defined in sp.gs
    if (headers.length === 0) return;

    var trackingColIndex = headers.indexOf(TRACKING_FIELD); // TRACKING_FIELD defined in sp.gs
    var statusColIndex = headers.indexOf('status');
    var nameColIndex = headers.indexOf('name');

    if (trackingColIndex === -1 || statusColIndex === -1) {
        console.error("Thiếu cột tracking_number hoặc status trong sheet.");
        return;
    }

    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    // Get all data
    var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

    for (var i = 0; i < data.length; i++) {
        var row = data[i];
        var trackingNumber = row[trackingColIndex];
        var currentStatus = row[statusColIndex] ? row[statusColIndex].toString().trim() : "";
        var name = nameColIndex !== -1 ? row[nameColIndex] : "Khách hàng";

        // Skip empty tracking numbers
        if (!trackingNumber) continue;

        // Filter out completed or cancelled orders
        var lowerStatus = currentStatus.toLowerCase();
        if (lowerStatus.includes("giao hàng thành công") || lowerStatus.includes("hủy")) {
            continue;
        }

        // Fetch tracking info
        var record = fetchSPXTrackingInfo(trackingNumber);
        if (record) {
            var newStatus = record.description || record.tracking_name || "";
            var actualTime = formatTimestamp(record.actual_time);
            var locationName = record.current_location && record.current_location.location_name ? record.current_location.location_name : "";

            // If status changed
            if (newStatus && newStatus !== currentStatus) {
                // Update sheet
                sheet.getRange(i + 2, statusColIndex + 1).setValue(newStatus);

                // Send telegram notification
                var message = "📦 CẬP NHẬT TRẠNG THÁI VẬN ĐƠN\n";
                message += "- Mã vận đơn: " + trackingNumber + "\n";
                message += "- Tên khách hàng: " + name + "\n";
                message += "- Trạng thái: " + newStatus + "\n";
                if (actualTime) message += "- Thời gian: " + actualTime + "\n";
                if (locationName) message += "- Vị trí: " + locationName;

                sendTelegramNotificationSP(message);

                // Delay slightly to avoid hitting API limits
                Utilities.sleep(500);
            }
        }
    }
}