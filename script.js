 // ===== CONFIG =====
      const REGISTER_URL = "https://trkrdr0.com/link/yv1dCOSZ3n";

      // Ruleta 4 premios (negro/dorado alternados)
      const FIXED_WIN_INDEX = 0; // 0..3 (siempre gana este)
      const prizes = ["Duplicar saldo", "50 Free Spins", "Cashback 10%", "Bono VIP"];

      // Toast cada 15s
      const PAYMENTS_TOAST_INTERVAL_MS = 15000;
      const PAYMENTS_TOAST_VISIBLE_MS = 5200;

      // ===== UI =====
      const canvas = document.getElementById("wheel");
      const ctx = canvas.getContext("2d");
      const spinBtn = document.getElementById("spinBtn");
      const resetBtn = document.getElementById("resetBtn");

      const popupOverlay = document.getElementById("popupOverlay");
      const popupText = document.getElementById("popupText");
      const closePopup = document.getElementById("closePopup");
      const claimBtn = document.getElementById("claimBtn");
      claimBtn.href = REGISTER_URL;

      const playersCountEl = document.getElementById("playersCount");

      // Toast UI
      const paymentsToast = document.getElementById("paymentsToast");
      const toastClose = document.getElementById("toastClose");
      const toastLogo = document.getElementById("toastLogo");
      const toastLine1 = document.getElementById("toastLine1");
      const toastLine2 = document.getElementById("toastLine2");

      // ===== STATE =====
      let angle = 0;
      let spinning = false;
      let hasSpun = false;

      // Idle spin
      let idleActive = true;
      let idleRaf = 0;
      const IDLE_SPEED = 0.0045; // rad/frame

      const GOLD = "#ffc400";
      const BLACK = "#0b0b0b";

      // ===== COUNTER (fake, diario) =====
      const STORAGE_DATE_KEY = "jg_counter_date";
      const STORAGE_COUNT_KEY = "jg_counter_value";
      const today = new Date().toISOString().slice(0, 10);

      function formatNumber(n){ return n.toLocaleString("es-CL"); }

      function initCounter(){
        const savedDate = localStorage.getItem(STORAGE_DATE_KEY);
        const savedCount = parseInt(localStorage.getItem(STORAGE_COUNT_KEY), 10);

        let count;
        if (savedDate === today && !Number.isNaN(savedCount)) {
          count = savedCount;
        } else {
          count = 2400 + Math.floor(Math.random() * 1400);
          localStorage.setItem(STORAGE_DATE_KEY, today);
          localStorage.setItem(STORAGE_COUNT_KEY, String(count));
        }

        playersCountEl.textContent = formatNumber(count);

        const tick = () => {
          const add = 1 + Math.floor(Math.random() * 5);
          count += add;
          playersCountEl.textContent = formatNumber(count);
          localStorage.setItem(STORAGE_COUNT_KEY, String(count));
          const next = 1800 + Math.floor(Math.random() * 4500);
          setTimeout(tick, next);
        };

        setTimeout(tick, 2200);
      }

      // ===== DRAW =====
      function drawWheel(currentAngle, opts = { spinning: false }){
        const w = canvas.width;
        const h = canvas.height;
        const cx = w/2;
        const cy = h/2;
        const r = Math.min(cx,cy) - 14;

        ctx.clearRect(0,0,w,h);

        // ring
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r + 6, 0, Math.PI*2);
        ctx.strokeStyle = opts.spinning ? "rgba(255,196,0,0.36)" : "rgba(255,196,0,0.24)";
        ctx.lineWidth = 12;
        ctx.stroke();
        ctx.restore();

        const n = prizes.length;
        const slice = (Math.PI*2)/n;

        ctx.save();
        ctx.filter = opts.spinning ? "blur(0.35px)" : "none";

        for (let i=0;i<n;i++){
          const start = currentAngle + i*slice;
          const end = start + slice;

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r, start, end);
          ctx.closePath();

          ctx.fillStyle = (i % 2 === 0) ? GOLD : BLACK;
          ctx.fill();

          ctx.strokeStyle = (i % 2 === 0) ? "rgba(0,0,0,0.55)" : "rgba(255,196,0,0.30)";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(start + slice/2);
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          ctx.font = "900 15px Arial";
          ctx.fillStyle = (i % 2 === 0) ? "#000" : GOLD;
          ctx.fillText(prizes[i], r - 18, 0);
          ctx.restore();
        }

        ctx.restore();

        // center cap
        ctx.beginPath();
        ctx.arc(cx, cy, 56, 0, Math.PI*2);
        ctx.fillStyle = "#070707";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,196,0,0.70)";
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.font = "950 14px Arial";
        ctx.fillStyle = GOLD;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("JokerGol", cx, cy);

        // marker line under pointer
        ctx.beginPath();
        ctx.moveTo(cx, cy - (r + 6));
        ctx.lineTo(cx, cy - 78);
        ctx.strokeStyle = "rgba(255,196,0,0.85)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // dot at contact
        ctx.beginPath();
        ctx.arc(cx, cy - (r - 2), 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,196,0,0.95)";
        ctx.fill();
      }

      // ===== IDLE SPIN =====
      function startIdle(){
        idleActive = true;
        const tick = () => {
          if (!idleActive || spinning) return;
          angle += IDLE_SPEED;
          drawWheel(angle, { spinning: false });
          idleRaf = requestAnimationFrame(tick);
        };
        cancelAnimationFrame(idleRaf);
        idleRaf = requestAnimationFrame(tick);
      }

      function stopIdle(){
        idleActive = false;
        cancelAnimationFrame(idleRaf);
      }

      // ===== WIN MATH =====
      // Pointer at TOP: -90° (3π/2)
      function computeFinalAngleForWinner(winnerIndex){
        const n = prizes.length;
        const slice = (Math.PI*2)/n;
        const pointerAngle = (Math.PI*3)/2;

        const winnerCenter = winnerIndex*slice + slice/2;
        const base = pointerAngle - winnerCenter;

        const turns = 7 + Math.floor(Math.random()*2); // 7..8 vueltas
        const jitter = (Math.random() - 0.5) * (slice * 0.16);

        return base + turns*Math.PI*2 + jitter;
      }

      function easeOutQuint(t){ return 1 - Math.pow(1 - t, 5); }

      function openWinnerPopup(winnerLabel){
        popupText.textContent = `Quiero obtener la promo — Premio: ${winnerLabel}`;
        popupOverlay.style.display = "flex";
        requestAnimationFrame(() => popupOverlay.classList.add("show"));
      }

      function closeWinnerPopup(){
        popupOverlay.classList.remove("show");
        setTimeout(() => { popupOverlay.style.display = "none"; }, 120);
      }

      function animateSpin(targetAngle){
        spinning = true;
        hasSpun = true;
        spinBtn.disabled = true;
        stopIdle();

        const start = angle;
        const change = targetAngle - start;

        const durationMain = 3800;
        const durationSettle = 360;

        const t0 = performance.now();

        const step = (now) => {
          const t = Math.min(1, (now - t0) / durationMain);
          const eased = easeOutQuint(t);

          angle = start + change * eased;
          drawWheel(angle, { spinning: true });

          if (t < 1) return requestAnimationFrame(step);

          // settle to exact final
          const settleStart = angle;
          const settleChange = targetAngle - settleStart;
          const s0 = performance.now();

          const settle = (n2) => {
            const se = Math.min(1, (n2 - s0) / durationSettle);
            const damp = 1 - Math.pow(1 - se, 3);
            angle = settleStart + settleChange * damp;

            drawWheel(angle, { spinning: false });

            if (se < 1) return requestAnimationFrame(settle);

            spinning = false;
            openWinnerPopup(prizes[FIXED_WIN_INDEX]);
          };

          requestAnimationFrame(settle);
        };

        requestAnimationFrame(step);
      }

      function reset(){
        spinning = false;
        hasSpun = false;
        spinBtn.disabled = false;
        closeWinnerPopup();
        startIdle();
      }

      // ===== PAYMENTS TOAST (fake) =====
      const paymentMethods = [
        { key: "Mach", logo: "img/mach.png" },
        { key: "Banco", logo: "img/banco.png" },
        { key: "Skrill", logo: "img/skrill.png" },
        { key: "Webpay", logo: "img/webpay.png" },
      ];

      const firstNames = [
        "Matías","Benjamín","Vicente","Joaquín","Tomás","Martina","Sofía","Valentina","Antonia","Josefa",
        "Ignacio","Diego","Sebastián","Nicolás","Felipe","Camila","Catalina","Fernanda","Paula","Daniela",
        "Cristóbal","Francisco","Pablo","Mauricio","Rodrigo","Karina","Constanza","Bárbara","María","Javiera"
      ];
      const lastNames = [
        "González","Muñoz","Rojas","Díaz","Pérez","Soto","Contreras","Silva","Martínez","Sepúlveda",
        "Morales","Rodríguez","López","Fuentes","Hernández","Torres","Araya","Flores","Espinoza","Valdés"
      ];
      const cities = ["Santiago","Valparaíso","Concepción","La Serena","Antofagasta","Temuco","Iquique","Rancagua","Talca","Puerto Montt"];

      function randInt(min, max){
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }

      function randomUser(){
        const fn = firstNames[randInt(0, firstNames.length - 1)];
        const ln = lastNames[randInt(0, lastNames.length - 1)];
        const city = cities[randInt(0, cities.length - 1)];
        const initial = ln[0] || "X";
        return `${fn} ${initial}. (${city})`;
      }

      function randomAmountCLP(){
        const amount = randInt(10000, 1000000);
        return amount;
      }

      function formatCLP(amount){
        return "$" + amount.toLocaleString("es-CL") + " CLP";
      }

      // Pre-generate “many users” to rotate
      const paymentFeed = Array.from({ length: 200 }, () => {
        const method = paymentMethods[randInt(0, paymentMethods.length - 1)];
        return {
          user: randomUser(),
          method: method.key,
          logo: method.logo,
          amount: randomAmountCLP(),
        };
      });
      let paymentIndex = 0;
      let toastTimer = 0;

      function showPaymentsToast(entry){
        toastLogo.src = entry.logo;
        toastLogo.alt = entry.method;
        toastLine1.textContent = `${entry.user} • ${entry.method}`;
        toastLine2.textContent = formatCLP(entry.amount);

        paymentsToast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(hidePaymentsToast, PAYMENTS_TOAST_VISIBLE_MS);
      }

      function hidePaymentsToast(){
        paymentsToast.classList.remove("show");
      }

      function nextPaymentEntry(){
        // Refresh item occasionally to keep it “alive”
        const base = paymentFeed[paymentIndex % paymentFeed.length];
        const refreshed = {
          user: base.user,
          method: base.method,
          logo: base.logo,
          amount: randomAmountCLP(),
        };
        paymentIndex += 1;
        return refreshed;
      }

      function startPaymentsTicker(){
        // show first after a short delay
        setTimeout(() => showPaymentsToast(nextPaymentEntry()), 4500);

        setInterval(() => {
          // don’t annoy while winner popup is open; still enqueue next later
          if (popupOverlay.style.display === "flex") return;
          showPaymentsToast(nextPaymentEntry());
        }, PAYMENTS_TOAST_INTERVAL_MS);
      }

      toastClose.addEventListener("click", hidePaymentsToast);

      // ===== EVENTS =====
      spinBtn.addEventListener("click", () => {
        if (spinning || hasSpun) return;
        animateSpin(computeFinalAngleForWinner(FIXED_WIN_INDEX));
      });

      resetBtn.addEventListener("click", reset);

      closePopup.addEventListener("click", closeWinnerPopup);
      popupOverlay.addEventListener("click", (e) => {
        if (e.target === popupOverlay) closeWinnerPopup();
      });

      // ===== INIT =====
      initCounter();
      drawWheel(angle, { spinning: false });
      startIdle();
      startPaymentsTicker();