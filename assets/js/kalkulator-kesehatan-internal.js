// Definisikan kontainer di paling atas
const kalkulatorContainer = document.getElementById('kalkulator-premi-container');

// Helpers
const fmtIDR = (n) => n.toLocaleString('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 });
function getAgeFromDateInput(ymd){
  if(!ymd) return 0;
  const [y,m,d] = ymd.split('-').map(Number);
  if(!y||!m||!d) return 0;
  
  const today = new Date();
  const tY = today.getFullYear();
  const tM = today.getMonth() + 1;
  const tD = today.getDate();
  
  // Cek apakah hari ini adalah tepat hari ulang tahun
  const todayIsBirthday = (tM === m && tD === d);

  // 1. Hitung usia kronologis (usia sebenarnya pada ulang tahun terakhir)
  let age = tY - y;
  const hasBirthdayPassed = (tM > m) || (tM === m && tD > d);
  if (!hasBirthdayPassed && !todayIsBirthday) {
    age = age - 1;
  }

  // --- LOGIKA BARU SESUAI DEFINISI ANDA ---
  // 2. Terapkan aturan Age Next Birthday (ANB) yang benar
  // Jika hari ini BUKAN hari ulang tahun yang tepat, bulatkan usia ke atas.
  if (!todayIsBirthday) {
    age = age + 1;
  }
  // Jika hari ini TEPAT hari ulang tahun, usia tidak diubah (sudah bulat).
  // ------------------------------------------

  return Math.max(0, age);
}

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyaOPMrLYsT8Eu1TLezHLIdkTRwihSuSiFwKpkNhQKWDGtWDanA09ap4TBRscCMKHzQbg/exec';

// Fungsi baru untuk mengambil data dan mencari premi
async function estimatePremium({age, gender, produk, plan, saver, smoke}) {
    // Pastikan semua input ada
    if (!age || !gender || !produk || !plan || !saver || !smoke) return 0;

    // Bangun URL dengan parameter kriteria
    const url = new URL('https://script.google.com/macros/s/AKfycbzSAUiKufqDQL3E2bZyeNs9MQllchUXF0BNSYQKwgFs67-oqbgsJXOi8rxDuQrzBUrm/exec');
    url.searchParams.set('type', 'premium');
    url.searchParams.set('produk', produk);
    url.searchParams.set('smoke', smoke);
    url.searchParams.set('age', age);
    url.searchParams.set('gender', gender);
    url.searchParams.set('plan', plan);
    url.searchParams.set('saver', saver);

    try {
    const response = await fetch(url);
    if (!response.ok) {
        console.error('Gagal mengambil data premi dari Apps Script.');
        return 0;
    }
    const result = await response.json();
    const basePremium = Number(String(result.value).replace(/[^0-9]/g, ''));
    return Math.round(basePremium);
    } catch (error) {
    console.error('Terjadi error saat memproses data premi:', error);
    return 0;
    }
}

// Fungsi untuk mengambil data diskon
async function getDiscountPercentage({produk, plan, smoke}) {
    if (!produk || !plan || !smoke) return 0;

    // Bangun URL dengan parameter kriteria
    const url = new URL('https://script.google.com/macros/s/AKfycbzSAUiKufqDQL3E2bZyeNs9MQllchUXF0BNSYQKwgFs67-oqbgsJXOi8rxDuQrzBUrm/exec');
    url.searchParams.set('type', 'diskon');
    url.searchParams.set('produk', produk);
    url.searchParams.set('smoke', smoke);
    url.searchParams.set('plan', plan);
    
    try {
    const response = await fetch(url);
    if (!response.ok) {
        console.error('Gagal mengambil data diskon dari Apps Script.');
        return 0;
    }
    const result = await response.json();
    return Number(result.value) || 0;
    } catch (error) {
    console.error('Terjadi error saat memproses data diskon:', error);
    return 0;
    }
}

// Fungsi baru untuk mengirim (log) data ke Google Sheet via Apps Script
function logDataToSheet(logData) {
    // Kita tidak perlu 'await' proses ini, biarkan berjalan di background agar user tidak perlu menunggu
    fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors', // Penting untuk menghindari error CORS saat mengirim ke Apps Script
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(logData)
    })
    .then(response => console.log('Log berhasil.'))
    .catch(error => console.error('Log gagal:', error));
}

// Ubah fungsi calc menjadi async untuk menunggu hasil dari estimatePremium
async function calc() {
    if (!validateForm()) {
    const rf = kalkulatorContainer.querySelector('#resultsFloat');
    const rb = kalkulatorContainer.querySelector('#resultsBackdrop');
    if (rf) rf.classList.add('hide');
    if (rb) rb.classList.add('hide');
    return;
    }
    
    const loader = kalkulatorContainer.querySelector('#loader');
    
    try {
    // ---> 1. Tampilkan loader saat perhitungan dimulai
    loader.classList.remove('hide');

    const data = {
        age: getAgeFromDateInput(kalkulatorContainer.querySelector('#dob').value),
        gender: kalkulatorContainer.querySelector('#gender').value,
        produk: kalkulatorContainer.querySelector('#produk').value,
        smoke: kalkulatorContainer.querySelector('#smoke').value,
        plan: kalkulatorContainer.querySelector('#plan').value,
        saver: kalkulatorContainer.querySelector('#saver').value,
    };

    fillSummary();

    const raw = await estimatePremium(data); 
    const discPct = await getDiscountPercentage({ produk: data.produk, plan: data.plan, smoke: data.smoke });
    
    kalkulatorContainer.querySelector('#disc').textContent = discPct;
    
    let net = 0; // Inisialisasi premi final
    if (raw > 0) {
        kalkulatorContainer.querySelector('#premi').textContent = fmtIDR(raw) + ' / tahun';
        const premiSetelahDiskon = raw * (100 - discPct) / 100;
        net = Math.round(premiSetelahDiskon / 1000) * 1000;
        kalkulatorContainer.querySelector('#premiNet').textContent = fmtIDR(net) + ' / tahun';
    } else {
        kalkulatorContainer.querySelector('#premi').textContent = 'Data tidak ditemukan';
        kalkulatorContainer.querySelector('#premiNet').textContent = 'Data tidak ditemukan';
    }

    // Siapkan data untuk dikirim ke Google Sheet
    const logPayload = {
        nama: kalkulatorContainer.querySelector('#nama').value,
        wa: kalkulatorContainer.querySelector('#wa').value,
        email: kalkulatorContainer.querySelector('#email').value,
        gender: data.gender,
        dob: kalkulatorContainer.querySelector('#dob').value,
        smoke: data.smoke,
        produk: data.produk,
        plan: data.plan,
        saver: data.saver,
        premiAwal: raw,
        diskon: discPct,
        premiFinal: net,
        userAgent: navigator.userAgent // Info browser dan device
    };
    // Panggil fungsi untuk mengirim data ke log
    logDataToSheet(logPayload);
    // -------------------------
    
    // Tampilkan jendela hasil
    kalkulatorContainer.querySelector('#resultsFloat').classList.remove('hide');
    kalkulatorContainer.querySelector('#resultsBackdrop').classList.remove('hide');
    requestAnimationFrame(fitModal);

    } catch (error) {
    // Jika terjadi error, catat di console dan beritahu user
    console.error("Terjadi kesalahan saat kalkulasi:", error);
    alert("Gagal memproses data. Silakan coba lagi.");
    } finally {
    // ---> 2. Sembunyikan loader setelah semuanya selesai (baik berhasil maupun gagal)
    loader.classList.add('hide');
    }
}

// Pastikan event listener tidak berubah
kalkulatorContainer.querySelector('#hitung').addEventListener('click', calc);

// FILTER BAR logic perlu?
const produkSel = kalkulatorContainer.querySelector('#produk');
const planSel = kalkulatorContainer.querySelector('#plan');
const saverSel = kalkulatorContainer.querySelector('#saver');
const hitungBtn = kalkulatorContainer.querySelector('#hitung');

// --- Input restrictions & formatting ---

// WA: angka saja
const waField = kalkulatorContainer.querySelector('#wa');
waField.addEventListener('input', () => {
    waField.value = waField.value.replace(/\D/g,'');
});
// --- Validation helpers ---
function clearErrors(){
    kalkulatorContainer.querySelectorAll('.errorMsg').forEach(function(el){ el.remove(); });
    kalkulatorContainer.querySelectorAll('.error').forEach(function(el){ el.classList.remove('error'); });
}
function addError(id, msg){
    var el = kalkulatorContainer.querySelector('#' + id);
    if(!el) return;
    el.classList.add('error');
    var field = el.closest('.field') || el.parentElement;
    var msgEl = document.createElement('div');
    msgEl.setAttribute('class','errorMsg');
    msgEl.textContent = '* ' + msg;
    field.appendChild(msgEl);
}
function validateForm(){
    clearErrors();
    var ok = true;
    var required = [
    ['gender','Jenis kelamin wajib dipilih'],
    ['dob','Tanggal lahir wajib diisi'],
    ['smoke','Status merokok wajib dipilih'],
    ['produk','Nama produk wajib dipilih'],
    ['plan','Plan wajib dipilih'],
    ['saver','Opsi Saver wajib dipilih']
    ];
    required.forEach(function(item){
    var id=item[0], msg=item[1];
    var el = kalkulatorContainer.querySelector('#' + id);
    var val = (el && (el.value||'').trim()) || '';
    if(!val){ ok=false; addError(id,msg); }
    });
    var firstErr = kalkulatorContainer.querySelector('.error');
    if(firstErr) firstErr.scrollIntoView({behavior:'smooth', block:'center'});
    return ok;
}

// --- Summary helpers ---
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const toDisplayDMY = (ymd) => { if(!ymd) return ''; const [y,m,d] = ymd.split('-'); const idx = Math.max(0, Math.min(11, parseInt(m,10)-1)); return `${d}-${MONTH_ABBR[idx]}-${y}`; };
// Mirror formatted date into overlay span
const dobInput = kalkulatorContainer.querySelector('#dob');
const dobDisplay = kalkulatorContainer.querySelector('#dobDisplay');
function refreshDobDisplay(){
    const ymd = dobInput.value;
    if(ymd){ dobDisplay.textContent = toDisplayDMY(ymd); dobDisplay.classList.remove('empty'); }
    else { dobDisplay.textContent = 'dd-Mmm-yyyy'; dobDisplay.classList.add('empty'); }
}
if(dobInput && dobDisplay){
    dobInput.addEventListener('input', refreshDobDisplay);
    dobInput.addEventListener('change', refreshDobDisplay);
    refreshDobDisplay();
}
const selText = (id) => { const el = kalkulatorContainer.querySelector('#' + id); return el && el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : ''; };
function fillSummary(){
    const v = (id) => (kalkulatorContainer.querySelector('#' + id).value || '').trim();
    kalkulatorContainer.querySelector('#s_nama').textContent = v('nama') || '-';
    kalkulatorContainer.querySelector('#s_wa').textContent = v('wa') || '-';
    kalkulatorContainer.querySelector('#s_email').textContent = v('email') || '-';
    kalkulatorContainer.querySelector('#s_gender').textContent = selText('gender') || '-';
    kalkulatorContainer.querySelector('#s_dob').textContent = v('dob') ? toDisplayDMY(v('dob')) : '-';
    kalkulatorContainer.querySelector('#s_smoke').textContent = selText('smoke') || '-';
    kalkulatorContainer.querySelector('#s_produk').textContent = selText('produk') || '-';
    kalkulatorContainer.querySelector('#s_plan').textContent = selText('plan') || '-';
    kalkulatorContainer.querySelector('#s_saver').textContent = selText('saver') || '-';
}

// Modal auto-fit to viewport (no internal scrolling)
function fitModal(){
    const modal = kalkulatorContainer.querySelector('#resultsFloat');
    if(!modal || modal.classList.contains('hide')) return;
    // reset to natural size first
    modal.style.transform = 'translate(-50%,-50%) scale(1)';
    const rect = modal.getBoundingClientRect();
    const vw = Math.min(window.innerWidth || 0, document.documentElement.clientWidth || 0) || window.innerWidth;
    const vh = Math.min(window.innerHeight || 0, document.documentElement.clientHeight || 0) || window.innerHeight;
    const PAD = 24; // breathing room
    const scale = Math.min(1, (vw - PAD) / rect.width, (vh - PAD) / rect.height);
    modal.style.transform = `translate(-50%,-50%) scale(${scale})`;
}

// Close / hide handlers
function hideResults(){
    kalkulatorContainer.querySelector('#resultsFloat').classList.add('hide');
    kalkulatorContainer.querySelector('#resultsBackdrop').classList.add('hide');
}
kalkulatorContainer.querySelector('#closeResults').addEventListener('click', hideResults);
kalkulatorContainer.querySelector('#resultsBackdrop').addEventListener('click', hideResults);
document.addEventListener('keydown', (e) => { if(e.key === 'Escape') hideResults(); });
window.addEventListener('resize', fitModal);
if(window.visualViewport){ window.visualViewport.addEventListener('resize', fitModal); }
if(document.fonts && document.fonts.ready){ document.fonts.ready.then(fitModal); }

const FETCH_URL = 'https://script.google.com/macros/s/AKfycbzSAUiKufqDQL3E2bZyeNs9MQllchUXF0BNSYQKwgFs67-oqbgsJXOi8rxDuQrzBUrm/exec';

// Fungsi baru untuk mengambil daftar produk dari Google Sheet dan mengisinya ke dropdown
async function populateProductDropdown() {
  // Beri tahu pengguna bahwa data sedang dimuat
  produkSel.disabled = true;
  produkSel.options[0].textContent = 'Memuat produk...';

  try {
    const url = new URL(FETCH_URL);
    url.searchParams.set('type', 'getProducts');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Gagal mengambil daftar produk.');    
    const productList = await response.json();

    // Kembalikan ke teks "Pilih" dan aktifkan kembali dropdown
    produkSel.options[0].textContent = 'Pilih';
    produkSel.disabled = false;
    
    // Isi dropdown dengan pilihan produk dari Google Sheet
    productList.forEach(productName => {
      const option = document.createElement('option');
      option.value = productName;
      option.textContent = productName;
      produkSel.appendChild(option);
    });

  } catch (error) {
    console.error(error);
    // Tampilkan pesan error jika gagal
    produkSel.options[0].textContent = 'Gagal Memuat';
  }
}

// Fungsi baru untuk mengambil daftar plan dari Google Sheet dan mengisinya ke dropdown
async function updatePlanOptions(productName) {
  // Beri tahu pengguna bahwa data sedang dimuat
  planSel.disabled = true;
  hitungBtn.disabled = true;
  
  planSel.innerHTML = '<option disabled selected value="">Memuat Plan...</option>';
  // HANYA reset Saver jika Produk dikosongkan
  if (!productName) {
    planSel.innerHTML = '<option disabled selected value="">Pilih Produk Dulu</option>';
    planSel.disabled = false;
    hitungBtn.disabled = false;
    return;
  }

  try {
    const url = new URL(FETCH_URL);
    url.searchParams.set('type', 'getPlan');
    url.searchParams.set('product', productName);
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Gagal mengambil daftar plan.');
    
    const planList = await response.json();

    // Kembalikan ke teks "Pilih Plan" dan aktifkan kembali dropdown
    planSel.innerHTML = '<option disabled selected value="">Pilih</option>';
    
    
    // Isi dropdown dengan pilihan plan dari Google Sheet
    planList.forEach(planName => {
      const option = document.createElement('option');
      option.value = planName;
      option.textContent = planName;
      planSel.appendChild(option);
    });

    // Tampilkan pesan error jika gagal
  } catch (error) {
    console.error(error);
    planSel.innerHTML = '<option disabled selected value="">Gagal memuat</option>';
  } finally {
    planSel.disabled = false;
    hitungBtn.disabled = false;
  }
}

// --- EVENT LISTENERS (Pemicu) ---

// Panggil fungsi ini saat seluruh konten halaman HTML sudah siap
document.addEventListener('DOMContentLoaded', populateProductDropdown);

// Panggil updatePlanOptions saat produk berubah
produkSel.addEventListener('change', e => {
  updatePlanOptions(e.target.value);
});