// ==========================================
// CLEAR LOG FUNCTIONS
// ==========================================

/**
 * Xóa tất cả log của ngày hôm nay trong sheet api_log
 */
function clearTodayLogs() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('api_log');

    if (!sheet) {
        console.log("Sheet 'api_log' không tồn tại.");
        return {
            status: "error",
            message: "Sheet 'api_log' không tồn tại."
        };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
        return {
            status: "success",
            message: "Không có log nào để xóa.",
            deleted: 0
        };
    }

    // Lấy ngày hôm nay (chỉ lấy phần ngày, bỏ giờ)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Lấy tất cả dữ liệu (bỏ header)
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    let deletedCount = 0;

    // Duyệt từ dưới lên để tránh lỗi index khi xóa
    for (let i = data.length - 1; i >= 0; i--) {
        const timestamp = data[i][0]; // Cột timestamp

        if (timestamp instanceof Date) {
            // Kiểm tra nếu timestamp nằm trong khoảng từ 00:00:00 hôm nay đến 00:00:00 ngày mai
            if (timestamp >= today && timestamp < tomorrow) {
                sheet.deleteRow(i + 2); // +2 vì: +1 cho header, +1 cho index bắt đầu từ 0
                deletedCount++;
            }
        }
    }

    return {
        status: "success",
        message: `Đã xóa ${deletedCount} log của ngày hôm nay.`,
        deleted: deletedCount
    };
}

/**
 * Xóa tất cả log cũ hơn N ngày
 * @param {number} days - Số ngày (mặc định 7)
 */
function clearOldLogs(days) {
    days = days || 7;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('api_log');

    if (!sheet) {
        console.log("Sheet 'api_log' không tồn tại.");
        return {
            status: "error",
            message: "Sheet 'api_log' không tồn tại."
        };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
        return {
            status: "success",
            message: "Không có log nào để xóa.",
            deleted: 0
        };
    }

    // Tính ngày cắt (cutoff date)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    // Lấy tất cả dữ liệu (bỏ header)
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    let deletedCount = 0;

    // Duyệt từ dưới lên để tránh lỗi index khi xóa
    for (let i = data.length - 1; i >= 0; i--) {
        const timestamp = data[i][0]; // Cột timestamp

        if (timestamp instanceof Date) {
            // Xóa nếu timestamp cũ hơn cutoffDate
            if (timestamp < cutoffDate) {
                sheet.deleteRow(i + 2); // +2 vì: +1 cho header, +1 cho index bắt đầu từ 0
                deletedCount++;
            }
        }
    }

    return {
        status: "success",
        message: `Đã xóa ${deletedCount} log cũ hơn ${days} ngày.`,
        deleted: deletedCount,
        cutoffDate: cutoffDate.toISOString()
    };
}

/**
 * Xóa toàn bộ log (giữ lại header)
 */
function clearAllLogs() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('api_log');

    if (!sheet) {
        console.log("Sheet 'api_log' không tồn tại.");
        return {
            status: "error",
            message: "Sheet 'api_log' không tồn tại."
        };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
        return {
            status: "success",
            message: "Không có log nào để xóa.",
            deleted: 0
        };
    }

    const deletedCount = lastRow - 1;

    // Xóa tất cả dòng từ dòng 2 trở đi (giữ lại header)
    sheet.deleteRows(2, deletedCount);

    return {
        status: "success",
        message: `Đã xóa toàn bộ ${deletedCount} log.`,
        deleted: deletedCount
    };
}
