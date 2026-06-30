// ============================================
// GOOGLE APPS SCRIPT — SEGURIDAD PRODUCCIÓN
// ============================================

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({"status": "ok"}))
                       .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    // --- PARSEAR DATOS ---
    var data = JSON.parse(e.postData.contents);

    // --- CONFIGURACIÓN ---
    var SHEET_ID = "1nrozVX1BNcmWlq4iNpUkdr6XEiNDWsbwafVZKZlxyGs";
    var MAX_REQUESTS_PER_HOUR = 10;
    var MAX_NAME_LENGTH = 100;

    // --- RATE LIMITING ---
    var cache = CacheService.getPublicCache();
    var clientKey = data._hpt || 'no_hpt'; // honeypot token
    var rateKey = 'rate_' + clientKey;
    var requestCount = parseInt(cache.get(rateKey) || '0');

    if (requestCount >= MAX_REQUESTS_PER_HOUR) {
      return ContentService.createTextOutput(
        JSON.stringify({"status": "error", "message": "Límite de solicitudes alcanzado"})
      ).setMimeType(ContentService.MimeType.JSON);
    }
    cache.put(rateKey, requestCount + 1, 3600);

    // --- HONEYPOT CHECK ---
    if (data._hp && data._hp.length > 0) {
      // Bot detectado — falsificar éxito para no delatar la defensa
      return ContentService.createTextOutput(
        JSON.stringify({"status": "success"})
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // --- SANITIZACIÓN ---
    function sanitize(str) {
      if (typeof str !== 'string') return '';
      return str
        .replace(/^[=+\-@\t\r]/g, '')   // Fórmulas de Sheets
        .replace(/<[^>]*>/g, '')         // Tags HTML
        .replace(/javascript:/gi, '')    // XSS
        .replace(/on\w+=/gi, '')         // Event handlers
        .trim()
        .substring(0, MAX_NAME_LENGTH);
    }

    function sanitizeDni(str) {
      if (typeof str !== 'string') return '';
      return str.replace(/\D/g, '').substring(0, 8); // Solo dígitos, max 8
    }

    var nombre = sanitize(data.nombre);
    var dni = sanitizeDni(data.dni);
    var sucursal = sanitize(data.sucursal);

    // --- VALIDACIÓN BACKEND ---
    var errors = [];

    if (!nombre || nombre.length < 2) {
      errors.push('Nombre inválido');
    }

    if (!/^\d{7,8}$/.test(dni)) {
      errors.push('DNI debe ser 7 u 8 dígitos');
    }

    var sucursalesValidas = [
      'CENTRAL', 'AMENEDO', 'DECO', 'FRIAS', 'CONFORT 245',
      'HUDSON', 'RESTELLI', 'BURZACO 3105', 'BURZACO 3133',
      'CONFORT VARELA', 'EZPELETA', 'RANELAGH'
    ];

    if (sucursalesValidas.indexOf(sucursal) === -1) {
      errors.push('Sucursal inválida');
    }

    if (errors.length > 0) {
      return ContentService.createTextOutput(
        JSON.stringify({"status": "error", "message": errors.join(', ')})
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // --- DUPLICADOS (opcional: evitar mismo DNI en última hora) ---
    var sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var dniColumn = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
      for (var i = 0; i < dniColumn.length; i++) {
        if (String(dniColumn[i][0]) === dni) {
          // Verificar si la fila es reciente (última hora)
          var rowDate = sheet.getRange(i + 2, 1).getValue();
          if (rowDate instanceof Date) {
            var now = new Date();
            var diffHours = (now - rowDate) / (1000 * 60 * 60);
            if (diffHours < 1) {
              return ContentService.createTextOutput(
                JSON.stringify({"status": "error", "message": "Ya existe una solicitud reciente con este DNI"})
              ).setMimeType(ContentService.MimeType.JSON);
            }
          }
        }
      }
    }

    // --- INSERTAR FILA ---
    sheet.appendRow([
      new Date(),        // Timestamp
      nombre,            // Nombre sanitizado
      dni,               // DNI validado
      sucursal           // Sucursal validada
    ]);

    // --- LOG DE AUDITORÍA ---
    Logger.log('SUCCESS: nombre=' + nombre + ' dni=***' + dni.slice(-4) + ' sucursal=' + sucursal);

    return ContentService.createTextOutput(
      JSON.stringify({"status": "success"})
    ).setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    Logger.log('ERROR: ' + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({"status": "error", "message": "Error interno"})
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
