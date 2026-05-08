// ==========================================
// CẤU HÌNH CHUNG
// ==========================================
const SHEET_NAME = 'SP';
const CONFIG_SHEET_NAME = 'config';

// ==========================================
// CẤU HÌNH SHEET CONFIG (GAS_URL & các setting khác)
// ==========================================

/**
 * Set GAS_URL (URL của chính web app hiện tại) vào sheet Config.
 * Chạy thủ công từ Apps Script Editor khi deploy phiên bản mới.
 */
function setGAS_URL() {
    const url = ScriptApp.getService().getUrl();
    setConfigValue('GAS_URL', url, 'Google Apps Script Web App URL');
}

/**
 * Lấy giá trị từ sheet Config theo key.
 */
function getConfigValue(key) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(CONFIG_SHEET_NAME);
        sheet.appendRow(['key', 'value', 'description']);
    }

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString().trim().toLowerCase() === key.toString().trim().toLowerCase()) {
            return data[i][1];
        }
    }
    return null;
}

/**
 * Set giá trị vào sheet Config theo key. Tạo mới nếu chưa tồn tại, cập nhật nếu đã có.
 */
function setConfigValue(key, value, description) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(CONFIG_SHEET_NAME);
        sheet.appendRow(['key', 'value', 'description']);
    }

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString().trim().toLowerCase() === key.toString().trim().toLowerCase()) {
            sheet.getRange(i + 1, 2).setValue(value);
            if (description) {
                sheet.getRange(i + 1, 3).setValue(description);
            }
            return;
        }
    }

    sheet.appendRow([key, value, description || '']);
}

// Cấu hình cột cho Case Thêm Mới
const USERNAME_FIELD = 'username';

// Cấu hình cột cho Case Cập Nhật Order
const ORDER_ID_FIELD = 'order_id';
const TRACKING_FIELD = 'tracking_number';
const COOKIE_FIELD = 'cookie'; // Tên cột chứa cookie trên Sheet

// Các cột bổ sung cho Case Cập Nhật Order
const ORDER_FIELDS = [
    { key: 'shipping_name', field: 'shipping_name' },
    { key: 'shipping_address', field: 'shipping_address' },
    { key: 'name', field: 'name' },
    { key: 'total_price', field: 'total_price' }
];

/**
 * Hàm xử lý HTTP POST request (Router chính)
 */
function doPost(e) {
    try {
        if (!e || !e.postData || !e.postData.contents) {
            return jsonResponse({ status: "error", message: "Payload rỗng" });
        }
        const payload = JSON.parse(e.postData.contents);

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(SHEET_NAME);
        if (!sheet) {
            return jsonResponse({ status: "error", message: `Không tìm thấy sheet: ${SHEET_NAME}` });
        }

        const headers = getColumnNames(sheet);
        if (headers.length === 0) {
            return jsonResponse({ status: "error", message: "Sheet chưa có dòng tiêu đề." });
        }

        const requestUrl = payload.url || (e.parameter && e.parameter.url) || "";

        // ==========================================
        // ROUTING
        // ==========================================
        let actionName = "add_new_user";

        if (payload.action) {
            actionName = payload.action;
        } else if (requestUrl.indexOf("get_order_detail") !== -1) {
            actionName = "get_order_detail";
        }

        switch (actionName) {
            case "get_config":
                return handleGetConfig(payload);
            case "get_order_detail":
                return handleUpdateOrderCase(sheet, headers, payload, requestUrl, e);
            case "add_new_user":
            default:
                return handleAddNewCase(sheet, headers, payload);
        }

    } catch (error) {
        return jsonResponse({ status: "error", message: error.toString() });
    }
}

// ==========================================
// CÁC HÀM XỬ LÝ CHO TỪNG CASE
// ==========================================

/**
 * CASE: Lấy config từ sheet Config
 */
function handleGetConfig(payload) {
    const key = payload.key;
    if (!key) {
        return jsonResponse({
            status: "success",
            action: "GET_CONFIG",
            message: "Lấy toàn bộ config thành công.",
            data: getAllConfig()
        });
    }

    const value = getConfigValue(key);
    if (value === null) {
        return jsonResponse({
            status: "error",
            code: "CONFIG_NOT_FOUND",
            message: `Không tìm thấy config với key: ${key}`
        });
    }

    return jsonResponse({
        status: "success",
        action: "GET_CONFIG",
        message: `Lấy config '${key}' thành công.`,
        data: { key: key, value: value }
    });
}

/**
 * Lấy toàn bộ config từ sheet Config.
 */
function getAllConfig() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sheet) return {};

    const data = sheet.getDataRange().getValues();
    const config = {};
    for (let i = 1; i < data.length; i++) {
        if (data[i][0]) {
            config[data[i][0].toString().trim()] = data[i][1];
        }
    }
    return config;
}

/**
 * CASE: Cập nhật dữ liệu (Tìm theo SPC_F Cookie -> Cập nhật order_id & tracking_number)
 */
function handleUpdateOrderCase(sheet, headers, payload, requestUrl, e) {
    // 1. Lấy order_id
    let orderId = "";
    const urlMatch = requestUrl.match(/order_id=(\d+)/);
    if (urlMatch) {
        orderId = urlMatch[1];
    } else if (payload.data && payload.data.order_info_card) {
        orderId = payload.data.order_info_card.order_id;
    }
    orderId = orderId ? orderId.toString().trim() : "";

    // 2. Lấy tracking_number
    const dataObj = payload.response ? payload.response : payload;
    let trackingNumber = "";
    try {
        if (dataObj.data && dataObj.data.shipping_info && dataObj.data.shipping_info.parcels) {
            trackingNumber = dataObj.data.shipping_info.parcels[0].tracking_number;
        }
    } catch (err) { }

    // 3. Lấy SPC_F từ request để làm KHÓA CHÍNH TÌM KIẾM
    const incomingCookieStr = (payload.cookie || (e.parameter && e.parameter.cookie) || "").toString().trim();
    const incomingSPCF = getCookieValue(incomingCookieStr, "SPC_F");

    if (!incomingSPCF) {
        return jsonResponse({
            status: "error",
            message: "Không tìm thấy giá trị SPC_F trong request cookie để thực hiện update."
        });
    }

    // 4. Kiểm tra cột
    const orderIdColIndex = headers.indexOf(ORDER_ID_FIELD);
    const trackingColIndex = headers.indexOf(TRACKING_FIELD);
    const cookieColIndex = headers.indexOf(COOKIE_FIELD);

    if (orderIdColIndex === -1 || trackingColIndex === -1 || cookieColIndex === -1) {
        return jsonResponse({
            status: "error",
            message: `Sheet cần phải có các cột: '${ORDER_ID_FIELD}', '${TRACKING_FIELD}' và '${COOKIE_FIELD}'`
        });
    }

    // 5. TÌM DÒNG DỰA TRÊN SPC_F COOKIE (Quét cột Cookie)
    const rowIndex = findRowIndexBySPCF(sheet, cookieColIndex, incomingSPCF);

    if (rowIndex !== -1) {
        // ĐÃ TÌM THẤY DÒNG CÓ CHỨA SPC_F TƯƠNG ỨNG -> Thực hiện Cập nhật
        if (orderId) {
            // Dấu "'" ép kiểu String để tránh số dài bị biến dạng
            sheet.getRange(rowIndex, orderIdColIndex + 1).setValue("'" + orderId);
        }
        if (trackingNumber) {
            sheet.getRange(rowIndex, trackingColIndex + 1).setValue(trackingNumber);
        }

        // Cập nhật các trường bổ sung nếu có trong payload
        for (let i = 0; i < ORDER_FIELDS.length; i++) {
            const field = ORDER_FIELDS[i];
            const colIndex = headers.indexOf(field.field);
            if (colIndex !== -1 && payload[field.field]) {
                sheet.getRange(rowIndex, colIndex + 1).setValue(payload[field.field]);
            }
        }

        return jsonResponse({
            status: "success",
            action: "UPDATE",
            message: `Đã cập nhật order_id, tracking_number và thông tin bổ sung thành công cho dữ liệu có SPC_F: ${incomingSPCF}`
        });

    } else {
        // KHÔNG TÌM THẤY SPC_F TRÊN SHEET -> Trả về lỗi theo yêu cầu
        return jsonResponse({
            status: "error",
            code: "COOKIE_NOT_FOUND",
            message: `Update thất bại: Không tìm thấy bản ghi nào có SPC_F '${incomingSPCF}' trên Sheet.`
        });
    }
}

/**
 * CASE: Thêm mới User
 */
function handleAddNewCase(sheet, headers, payload) {
    const usernameIndex = headers.indexOf(USERNAME_FIELD);
    if (usernameIndex === -1) {
        return jsonResponse({ status: "error", message: `Không tìm thấy cột '${USERNAME_FIELD}' trên Sheet.` });
    }

    const username = payload[USERNAME_FIELD];
    if (!username) {
        return jsonResponse({ status: "error", message: `Payload thiếu trường '${USERNAME_FIELD}' bắt buộc.` });
    }

    const rowIndex = findRowIndexByValue(sheet, usernameIndex, username);
    if (rowIndex !== -1) {
        return jsonResponse({
            status: "error",
            code: "USERNAME_EXISTS",
            message: `Username '${username}' đã tồn tại trong hệ thống.`
        });
    }

    const rowData = headers.map(header => {
        return payload.hasOwnProperty(header) ? payload[header] : "";
    });

    sheet.appendRow(rowData);

    return jsonResponse({
        status: "success",
        action: "ADD_NEW",
        message: "Lưu dữ liệu mới thành công.",
        data: payload
    });
}

// ==========================================
// CÁC HÀM TIỆN ÍCH (HELPERS) DÙNG CHUNG
// ==========================================

function getColumnNames(sheet) {
    const lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) return [];
    return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
}

// Tìm dòng theo Text thông thường (Dùng cho check Username)
function findRowIndexByValue(sheet, headerIndex, searchValue) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return -1;
    const targetColumn = headerIndex + 1;
    const columnData = sheet.getRange(2, targetColumn, lastRow - 1, 1).getValues();
    const searchStr = searchValue.toString().trim().toLowerCase();

    for (let i = 0; i < columnData.length; i++) {
        const cellValue = columnData[i][0];
        if (cellValue !== null && cellValue !== undefined) {
            if (cellValue.toString().trim().toLowerCase() === searchStr) {
                return i + 2;
            }
        }
    }
    return -1;
}

// TÌM DÒNG BẰNG CÁCH QUÉT SPC_F TRONG CỘT COOKIE
function findRowIndexBySPCF(sheet, cookieColIndex, targetSPCF) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return -1;

    const targetColumn = cookieColIndex + 1;
    const columnData = sheet.getRange(2, targetColumn, lastRow - 1, 1).getValues();

    for (let i = 0; i < columnData.length; i++) {
        const cellCookieStr = (columnData[i][0] || "").toString();
        const cellSPCF = getCookieValue(cellCookieStr, "SPC_F");

        if (cellSPCF && cellSPCF === targetSPCF) {
            return i + 2;
        }
    }
    return -1;
}

// Hàm trích xuất giá trị của một key cụ thể từ chuỗi cookie
function getCookieValue(cookieString, cookieName) {
    if (!cookieString) return "";
    const match = cookieString.match(new RegExp('(^|;\\s*)' + cookieName + '=([^;]*)'));
    return match ? match[2].trim() : "";
}

function jsonResponse(responseData) {
    return ContentService.createTextOutput(JSON.stringify(responseData))
        .setMimeType(ContentService.MimeType.JSON);
}