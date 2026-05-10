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
    const url = "https://script.google.com/macros/s/AKfycbxh4kSSnUfuDxPjxZFy6r61FZ5RNLqSddnaj2vRBidwxHJ0_vgiHc6HSSy91JsOLiRC/exec";
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
        if (
            data[i][0] &&
            data[i][0].toString().trim().toLowerCase() ===
            key.toString().trim().toLowerCase()
        ) {
            return data[i][1];
        }
    }

    return null;
}

/**
 * Set giá trị vào sheet Config theo key.
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

        if (
            data[i][0] &&
            data[i][0].toString().trim().toLowerCase() ===
            key.toString().trim().toLowerCase()
        ) {

            sheet.getRange(i + 1, 2).setValue(value);

            if (description) {
                sheet.getRange(i + 1, 3).setValue(description);
            }

            return;
        }
    }

    sheet.appendRow([
        key,
        value,
        description || ''
    ]);
}

// ==========================================
// CONFIG
// ==========================================

const USERNAME_FIELD = 'username';

const ORDER_ID_FIELD = 'order_id';
const TRACKING_FIELD = 'tracking_number';
const COOKIE_FIELD = 'cookie';

const ORDER_FIELDS = [
    { key: 'shipping_name', field: 'shipping_name' },
    { key: 'shipping_address', field: 'shipping_address' },
    { key: 'name', field: 'name' },
    { key: 'total_price', field: 'total_price' }
];

// ==========================================
// ROUTER
// ==========================================

function doPost(e) {

    try {

        if (!e || !e.postData || !e.postData.contents) {

            const response = jsonResponse({
                status: "error",
                message: "Payload rỗng"
            });

            logApi(
                e,
                "",
                "",
                "ERROR",
                JSON.stringify({
                    status: "error",
                    message: "Payload rỗng"
                })
            );

            return response;
        }

        const payload = JSON.parse(e.postData.contents);

        const ss = SpreadsheetApp.getActiveSpreadsheet();

        const sheet = ss.getSheetByName(SHEET_NAME);

        if (!sheet) {

            const response = jsonResponse({
                status: "error",
                message: `Không tìm thấy sheet: ${SHEET_NAME}`
            });

            logApi(
                e,
                payload.action || "",
                "",
                "ERROR",
                JSON.stringify({
                    status: "error",
                    message: `Không tìm thấy sheet: ${SHEET_NAME}`
                })
            );

            return response;
        }

        const headers = getColumnNames(sheet);

        if (headers.length === 0) {

            const response = jsonResponse({
                status: "error",
                message: "Sheet chưa có dòng tiêu đề."
            });

            logApi(
                e,
                payload.action || "",
                "",
                "ERROR",
                JSON.stringify({
                    status: "error",
                    message: "Sheet chưa có dòng tiêu đề."
                })
            );

            return response;
        }

        const requestUrl =
            payload.url ||
            (e.parameter && e.parameter.url) ||
            "";

        // ==========================================
        // ROUTING
        // ==========================================

        let actionName = "add_new_user";

        if (payload.action) {
            actionName = payload.action;
        } else if (requestUrl.indexOf("get_order_detail") !== -1) {
            actionName = "get_order_detail";
        }

        let result;

        switch (actionName) {

            case "get_config":
                result = handleGetConfig(payload);
                break;

            case "get_all":
                result = handleGetAllCase(sheet, headers, payload);
                break;

            case "get_order_detail":
                result = handleUpdateOrderCase(
                    sheet,
                    headers,
                    payload,
                    requestUrl,
                    e
                );
                break;

            case "add_new_user":
            default:
                result = handleAddNewCase(
                    sheet,
                    headers,
                    payload
                );
                break;
        }

        logApi(
            e,
            actionName,
            requestUrl,
            result.status,
            JSON.stringify(result)
        );

        return jsonResponse(result);

    } catch (error) {

        const response = jsonResponse({
            status: "error",
            message: error.toString()
        });

        logApi(
            e,
            "",
            "",
            "ERROR",
            JSON.stringify({
                status: "error",
                message: error.toString()
            })
        );

        return response;
    }
}

// ==========================================
// CASES
// ==========================================

/**
 * CASE: Lấy config
 */
function handleGetConfig(payload) {

    const key = payload.key;

    if (!key) {

        return {
            status: "success",
            action: "GET_CONFIG",
            message: "Lấy toàn bộ config thành công.",
            data: getAllConfig()
        };
    }

    const value = getConfigValue(key);

    if (value === null) {

        return {
            status: "error",
            code: "CONFIG_NOT_FOUND",
            message: `Không tìm thấy config với key: ${key}`
        };
    }

    return {
        status: "success",
        action: "GET_CONFIG",
        message: `Lấy config '${key}' thành công.`,
        data: {
            key: key,
            value: value
        }
    };
}

/**
 * CASE: GET ALL
 */
function handleGetAllCase(sheet, headers, payload) {

    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {

        return {
            status: "success",
            action: "GET_ALL",
            message: "Sheet không có dữ liệu.",
            total: 0,
            data: []
        };
    }

    const values = sheet
        .getRange(2, 1, lastRow - 1, headers.length)
        .getValues();

    let data = values.map(row => {
        return mapRowToObject(headers, row);
    });

    // ==========================================
    // FILTER
    // ==========================================

    if (
        payload.filters &&
        typeof payload.filters === 'object'
    ) {
        data = applyFilters(data, payload.filters);
    }

    // ==========================================
    // SELECT FIELDS
    // ==========================================

    if (
        Array.isArray(payload.fields) &&
        payload.fields.length > 0
    ) {
        data = selectFields(data, payload.fields);
    }

    // ==========================================
    // PAGINATION
    // ==========================================

    const page = Number(payload.page || 1);

    const limit = Number(
        payload.limit || data.length
    );

    const start = (page - 1) * limit;

    const end = start + limit;

    const paginatedData = data.slice(start, end);

    return {
        status: "success",
        action: "GET_ALL",
        message: "Lấy dữ liệu thành công.",
        total: data.length,
        page: page,
        limit: limit,
        data: paginatedData
    };
}

/**
 * CASE: UPDATE ORDER
 */
function handleUpdateOrderCase(
    sheet,
    headers,
    payload,
    requestUrl,
    e
) {

    // ==========================================
    // LẤY ORDER ID
    // ==========================================

    let orderId = "";

    const urlMatch =
        requestUrl.match(/order_id=(\d+)/);

    if (urlMatch) {
        orderId = urlMatch[1];
    } else if (
        payload.data &&
        payload.data.order_info_card
    ) {
        orderId =
            payload.data.order_info_card.order_id;
    }

    orderId = orderId
        ? orderId.toString().trim()
        : "";

    // ==========================================
    // TRACKING NUMBER
    // ==========================================

    const dataObj = payload.response
        ? payload.response
        : payload;

    let trackingNumber = "";

    try {

        if (
            dataObj.data &&
            dataObj.data.shipping_info &&
            dataObj.data.shipping_info.parcels
        ) {
            trackingNumber =
                dataObj.data.shipping_info
                    .parcels[0]
                    .tracking_number;
        }

    } catch (err) { }

    // ==========================================
    // SPC_F
    // ==========================================

    const incomingCookieStr =
        (
            payload.cookie ||
            (e.parameter && e.parameter.cookie) ||
            ""
        )
            .toString()
            .trim();

    const incomingSPCF = getCookieValue(
        incomingCookieStr,
        "SPC_F"
    );

    if (!incomingSPCF) {

        return {
            status: "error",
            message:
                "Không tìm thấy giá trị SPC_F trong request cookie để thực hiện update."
        };
    }

    // ==========================================
    // CHECK COLUMN
    // ==========================================

    const orderIdColIndex =
        headers.indexOf(ORDER_ID_FIELD);

    const trackingColIndex =
        headers.indexOf(TRACKING_FIELD);

    const cookieColIndex =
        headers.indexOf(COOKIE_FIELD);

    if (
        orderIdColIndex === -1 ||
        trackingColIndex === -1 ||
        cookieColIndex === -1
    ) {

        return {
            status: "error",
            message:
                `Sheet cần phải có các cột: ` +
                `'${ORDER_ID_FIELD}', ` +
                `'${TRACKING_FIELD}' và ` +
                `'${COOKIE_FIELD}'`
        };
    }

    // ==========================================
    // FIND ROW
    // ==========================================

    const rowIndex = findRowIndexBySPCF(
        sheet,
        cookieColIndex,
        incomingSPCF
    );

    if (rowIndex !== -1) {

        if (orderId) {

            sheet
                .getRange(
                    rowIndex,
                    orderIdColIndex + 1
                )
                .setValue("'" + orderId);
        }

        if (trackingNumber) {

            sheet
                .getRange(
                    rowIndex,
                    trackingColIndex + 1
                )
                .setValue(trackingNumber);
        }

        // UPDATE EXTRA FIELD

        for (let i = 0; i < ORDER_FIELDS.length; i++) {

            const field = ORDER_FIELDS[i];

            const colIndex =
                headers.indexOf(field.field);

            if (
                colIndex !== -1 &&
                payload[field.field]
            ) {

                sheet
                    .getRange(
                        rowIndex,
                        colIndex + 1
                    )
                    .setValue(
                        payload[field.field]
                    );
            }
        }

        return {
            status: "success",
            action: "UPDATE",
            message:
                `Đã cập nhật order_id, tracking_number ` +
                `và thông tin bổ sung thành công ` +
                `cho dữ liệu có SPC_F: ${incomingSPCF}`
        };

    } else {

        return {
            status: "error",
            code: "COOKIE_NOT_FOUND",
            message:
                `Update thất bại: Không tìm thấy bản ghi nào ` +
                `có SPC_F '${incomingSPCF}' trên Sheet.`
        };
    }
}

/**
 * CASE: ADD NEW USER
 */
function handleAddNewCase(
    sheet,
    headers,
    payload
) {

    const usernameIndex =
        headers.indexOf(USERNAME_FIELD);

    if (usernameIndex === -1) {

        return {
            status: "error",
            message:
                `Không tìm thấy cột '${USERNAME_FIELD}' trên Sheet.`
        };
    }

    const username =
        payload[USERNAME_FIELD];

    if (!username) {

        return {
            status: "error",
            message:
                `Payload thiếu trường '${USERNAME_FIELD}' bắt buộc.`
        };
    }

    const rowIndex = findRowIndexByValue(
        sheet,
        usernameIndex,
        username
    );

    if (rowIndex !== -1) {

        return {
            status: "error",
            code: "USERNAME_EXISTS",
            message:
                `Username '${username}' đã tồn tại trong hệ thống.`
        };
    }

    const rowData = headers.map(header => {

        return payload.hasOwnProperty(header)
            ? payload[header]
            : "";
    });

    sheet.appendRow(rowData);

    return {
        status: "success",
        action: "ADD_NEW",
        message: "Lưu dữ liệu mới thành công.",
        data: payload
    };
}

// ==========================================
// CONFIG HELPERS
// ==========================================

function getAllConfig() {

    const ss =
        SpreadsheetApp.getActiveSpreadsheet();

    const sheet =
        ss.getSheetByName(CONFIG_SHEET_NAME);

    if (!sheet) return {};

    const data =
        sheet.getDataRange().getValues();

    const config = {};

    for (let i = 1; i < data.length; i++) {

        if (data[i][0]) {

            config[
                data[i][0].toString().trim()
            ] = data[i][1];
        }
    }

    return config;
}

// ==========================================
// HELPERS
// ==========================================

function getColumnNames(sheet) {

    const lastColumn = sheet.getLastColumn();

    if (lastColumn === 0) return [];

    return sheet
        .getRange(1, 1, 1, lastColumn)
        .getValues()[0];
}

/**
 * Convert row -> object
 */
function mapRowToObject(headers, row) {

    const obj = {};

    headers.forEach((header, index) => {
        obj[header] = row[index];
    });

    return obj;
}

/**
 * Filter helper
 */
function applyFilters(data, filters) {

    return data.filter(item => {

        for (const key in filters) {

            const filterValue = filters[key];

            if (
                item[key] === undefined ||
                item[key] === null
            ) {
                return false;
            }

            const itemValue = item[key]
                .toString()
                .trim()
                .toLowerCase();

            const searchValue = filterValue
                .toString()
                .trim()
                .toLowerCase();

            if (
                itemValue.indexOf(searchValue) === -1
            ) {
                return false;
            }
        }

        return true;
    });
}

/**
 * Select fields helper
 */
function selectFields(data, fields) {

    return data.map(item => {

        const obj = {};

        fields.forEach(field => {
            obj[field] = item[field];
        });

        return obj;
    });
}

// ==========================================
// FIND ROW HELPERS
// ==========================================

function findRowIndexByValue(
    sheet,
    headerIndex,
    searchValue
) {

    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) return -1;

    const targetColumn = headerIndex + 1;

    const columnData = sheet
        .getRange(
            2,
            targetColumn,
            lastRow - 1,
            1
        )
        .getValues();

    const searchStr = searchValue
        .toString()
        .trim()
        .toLowerCase();

    for (let i = 0; i < columnData.length; i++) {

        const cellValue = columnData[i][0];

        if (
            cellValue !== null &&
            cellValue !== undefined
        ) {

            if (
                cellValue
                    .toString()
                    .trim()
                    .toLowerCase() === searchStr
            ) {
                return i + 2;
            }
        }
    }

    return -1;
}

/**
 * Tìm dòng bằng SPC_F
 */
function findRowIndexBySPCF(
    sheet,
    cookieColIndex,
    targetSPCF
) {

    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) return -1;

    const targetColumn =
        cookieColIndex + 1;

    const columnData = sheet
        .getRange(
            2,
            targetColumn,
            lastRow - 1,
            1
        )
        .getValues();

    for (let i = 0; i < columnData.length; i++) {

        const cellCookieStr =
            (columnData[i][0] || "")
                .toString();

        const cellSPCF = getCookieValue(
            cellCookieStr,
            "SPC_F"
        );

        if (
            cellSPCF &&
            cellSPCF === targetSPCF
        ) {
            return i + 2;
        }
    }

    return -1;
}

/**
 * Get cookie value
 */
function getCookieValue(
    cookieString,
    cookieName
) {

    if (!cookieString) return "";

    const match = cookieString.match(
        new RegExp(
            '(^|;\\s*)' +
            cookieName +
            '=([^;]*)'
        )
    );

    return match
        ? match[2].trim()
        : "";
}

// ==========================================
// LOG API
// ==========================================

function logApi(
    e,
    action,
    requestUrl,
    status,
    response
) {

    const ss =
        SpreadsheetApp.getActiveSpreadsheet();

    let sheet =
        ss.getSheetByName('api_log');

    if (!sheet) {

        sheet = ss.insertSheet('api_log');

        sheet.appendRow([
            'timestamp',
            'action',
            'request_url',
            'status',
            'spc_f',
            'request_body',
            'response_body'
        ]);
    }

    // ==========================================
    // GET SPC_F
    // ==========================================

    let spcF = "";

    if (
        e &&
        e.postData &&
        e.postData.contents
    ) {

        try {

            const payload = JSON.parse(
                e.postData.contents
            );

            const cookieStr =
                (
                    payload.cookie || ""
                )
                    .toString()
                    .trim();

            spcF = getCookieValue(
                cookieStr,
                "SPC_F"
            );

        } catch (err) { }
    }

    // ==========================================
    // SHORT RESPONSE
    // ==========================================

    const responseShort =
        response &&
            response.length > 5000
            ? response.substring(0, 5000) +
            "... (truncated)"
            : response;

    sheet.appendRow([
        new Date(),
        action,
        requestUrl,
        status,
        spcF,
        e && e.postData
            ? e.postData.contents
            : "",
        responseShort
    ]);
}

// ==========================================
// JSON RESPONSE
// ==========================================

function jsonResponse(responseData) {

    return ContentService
        .createTextOutput(
            JSON.stringify(responseData)
        )
        .setMimeType(
            ContentService.MimeType.JSON
        );
}