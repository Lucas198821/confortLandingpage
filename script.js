document.addEventListener('DOMContentLoaded', () => {
    const creditForm = document.getElementById('creditForm');

    if (!creditForm) return;

    // --- SANITIZACIÓN FRONTEND ---
    function sanitize(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/^[=+\-@]/g, '')   // Fórmulas de Sheets
            .replace(/<[^>]*>/g, '')     // Tags HTML
            .replace(/[<>]/g, '')        // Resto de caracteres peligrosos
            .trim();
    }

    // --- RATE LIMITING LOCAL ---
    function canSubmit() {
        const now = Date.now();
        const last = parseInt(localStorage.getItem('lastSubmit') || '0');
        if (now - last < 5000) return false; // 5 segundos mínimo entre envíos
        return true;
    }

    function markSubmitted() {
        localStorage.setItem('lastSubmit', Date.now().toString());
    }

    creditForm.addEventListener('submit', function (e) {
        e.preventDefault();

        // --- HONEYPOT CHECK ---
        const hp = document.getElementById('website');
        if (hp && hp.value.length > 0) {
            // Bot detectado — falsificar éxito silenciosamente
            alert('¡Formulario enviado con éxito! Redirigiendo a WhatsApp...');
            return;
        }

        // --- CONSENT CHECK ---
        const consent = document.getElementById('consent');
        if (consent && !consent.checked) {
            alert('Debés aceptar la política de privacidad para continuar.');
            return;
        }

        // --- RATE LIMITING ---
        if (!canSubmit()) {
            alert('Esperá unos segundos antes de enviar nuevamente.');
            return;
        }

        // --- OBTENER Y SANITIZAR VALORES ---
        const rawNombre = document.getElementById('nombre').value.trim();
        const rawDni = document.getElementById('dni').value.trim();
        const sucursal = document.getElementById('sucursal').value;

        const nombre = sanitize(rawNombre);
        const dni = rawDni.replace(/\D/g, ''); // Solo dígitos

        // --- VALIDACIÓN FRONTEND ---
        if (!nombre || nombre.length < 2) {
            alert('Ingresá tu nombre completo.');
            return;
        }

        if (!/^\d{7,8}$/.test(dni)) {
            alert('El DNI debe contener entre 7 y 8 números.');
            return;
        }

        if (!sucursal) {
            alert('Seleccioná una sucursal.');
            return;
        }

        const branchNumbers = {
            'CENTRAL': '5491168968931',
            'AMENEDO': '5491166739900',
            'DECO': '5491128174943',
            'FRIAS': '5491138637558',
            'CONFORT 245': '5491161354317',
            'HUDSON': '5491122377875',
            'RESTELLI': '5491139093478',
            'BURZACO 3105': '5491131554992',
            'BURZACO 3133': '5491122962454',
            'CONFORT VARELA': '5491137007465',
            'EZPELETA': '5491150392863',
            'RANELAGH': '5491139388055'
        };

        const phoneNumber = branchNumbers[sucursal];

        if (!phoneNumber) {
            alert('Sucursal no válida.');
            return;
        }

        // --- UI: LOADING STATE ---
        const btn = this.querySelector('.submit-btn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> PROCESANDO...';

        const urlGoogleScript = "https://script.google.com/macros/s/AKfycbzZj0hPzVN5kEohZBH40xe9DQKhvjnScN-ch7yTT95vKzP_0rcMB3OaJdOF9OPFRf_ksg/exec";

        const datosCliente = {
            nombre: nombre,
            dni: dni,
            sucursal: sucursal,
            _hp: hp ? hp.value : '',    // Honeypot
            _hpt: Date.now().toString()  // Rate limit key
        };

        // --- FETCH CON MANEJO DE ERRORES ---
        fetch(urlGoogleScript, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datosCliente)
        })
        .then(() => {
            // no-cors: no podemos leer la respuesta, asumimos éxito
            markSubmitted();
            const mensaje = `Hola, soy *${nombre}* y estoy interesado/a en solicitar un crédito personal.\n\n` +
                `📋 *Datos del cliente:*\n` +
                `• Nombre: ${nombre}\n` +
                `• DNI: ${dni}\n` +
                `• Sucursal elegida: ${sucursal}\n\n` +
                `💰 *Monto estimado:* Hasta $1.000.000\n` +
                `📍 *Tipo de consulta:* Crédito personal (pre-calificación)\n\n` +
                `Quisiera que me asesoren sobre las opciones de financiamiento disponibles. ¡Muchas gracias!`;
            const encodedMessage = encodeURIComponent(mensaje);
            window.location.href = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        })
        .catch(() => {
            // Error de red — permitir reintentar
            btn.disabled = false;
            btn.innerHTML = originalText;
            alert('Hubo un problema de conexión. Intentá nuevamente.');
        });
    });
});
