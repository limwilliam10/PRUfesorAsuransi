// Definisikan kontainer di paling atas
const kalkulatorContainer = document.getElementById('kalkulator-premi-container');

// Helpers
const fmtIDR = (n) => n.toLocaleString('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 });
function getAgeFromDateInput(ymd){
    if(!ymd) return 0; // value from <input type="date"> is yyyy-mm-dd
    const [y,m,d] = ymd.split('-').map(Number);
    if(!y||!m||!d) return 0;
    const today = new Date();
    const tM = today.getMonth() + 1;
    const tD = today.getDate();
    const base = today.getFullYear() - y; // year difference
    const passed = (tM > m) || (tM === m && tD > d);       // ulang tahun SUDAH lewat tahun ini
    const todayIs = (tM === m && tD === d);                // tepat hari ulang tahun

    // Age Last Birthday baseline
    let age = base;
    if(!passed && !todayIs) age = base - 1;                // ulang tahun BELUM lewat → kurangi 1

    // Business rule: jika ulang tahun sudah lewat (strict), gunakan "usia berikutnya"
    if(passed) age = age + 1;

    return Math.max(0, age);
}

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJGLWDt4d-npwDy_5mpcds8kJE7ivwfqn-n8dcHJa1OluPcASMe1Mb1xTVuFiORqXw/exec';

// Fungsi baru untuk mengambil data dan mencari premi
async function estimatePremium({up, age, gender, produk, masa, smoke}) {
    // Pastikan semua input ada
    if (!up || !age || !gender || !produk || !masa || !smoke) return 0;

    // Bangun URL dengan parameter kriteria
    const url = new URL('https://script.google.com/macros/s/AKfycbxX9Y5LpmshAp32UPVJs4VkgfWXVd64SvISBpzxVpDiHItyiZJBJcW9KWsTbVa8zyArIg/exec');
    url.searchParams.set('type', 'premium');
    url.searchParams.set('produk', produk);
    url.searchParams.set('smoke', smoke);
    url.searchParams.set('age', age);
    url.searchParams.set('gender', gender);
    url.searchParams.set('masa', masa);

    try {
    const response = await fetch(url);
    if (!response.ok) {
        console.error('Gagal mengambil data premi dari Apps Script.');
        return 0;
    }
    const result = await response.json();
    const basePremium = Number(String(result.value).replace(/[^0-9]/g, ''));
    const finalPremium = basePremium * (up / 1000000000);
    return Math.round(finalPremium);
    } catch (error) {
    console.error('Terjadi error saat memproses data premi:', error);
    return 0;
    }
}

// Fungsi untuk mengambil data diskon
async function getDiscountPercentage({produk, up}) {
    if (!produk || !up) return 0;

    // Bangun URL dengan parameter kriteria
    const url = new URL('https://script.google.com/macros/s/AKfycbxX9Y5LpmshAp32UPVJs4VkgfWXVd64SvISBpzxVpDiHItyiZJBJcW9KWsTbVa8zyArIg/exec');
    url.searchParams.set('type', 'diskon');
    url.searchParams.set('produk', produk);
    url.searchParams.set('up', up);
    
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
// Ganti seluruh fungsi calc Anda dengan yang ini
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

    const masaText = kalkulatorContainer.querySelector('#masa').value || '';
    const data = {
        up: Number(kalkulatorContainer.querySelector('#up').value.replace(/[^0-9]/g, '')),
        age: getAgeFromDateInput(kalkulatorContainer.querySelector('#dob').value),
        gender: kalkulatorContainer.querySelector('#gender').value,
        produk: kalkulatorContainer.querySelector('#produk').value,
        masa: parseInt((masaText.match(/[0-9]+/) || [''])[0], 10) || 0,
        smoke: kalkulatorContainer.querySelector('#smoke').value,
    };

    fillSummary();

    const raw = await estimatePremium(data); 
    const discPct = await getDiscountPercentage({ produk: data.produk, up: data.up });
    
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
        up: data.up,
        masa: data.masa,
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

// FILTER BAR logic
// Conditional options for Masa Pembayaran berdasarkan Produk
const masaSel = kalkulatorContainer.querySelector('#masa');
const produkSel = kalkulatorContainer.querySelector('#produk');
const defaultMasa = ['5 tahun','10 tahun','15 tahun'];
// Fungsi baru untuk mengambil dan mengisi pilihan Masa Pembayaran
async function updateMasaOptionsFromSheet(productName) {
  // Kosongkan dan nonaktifkan dropdown saat memuat
  masaSel.innerHTML = '<option disabled selected value="">Memuat...</option>';
  masaSel.disabled = true;

  if (!productName) {
    masaSel.innerHTML = '<option disabled selected value="">Pilih produk dulu</option>';
    return;
  }

  try {
    const url = new URL(GOOGLE_APPS_SCRIPT_URL);
    url.searchParams.set('type', 'getTerms');
    url.searchParams.set('product', productName);

    const response = await fetch(url);
    if (!response.ok) throw new Error('Gagal mengambil data masa pembayaran.');
    
    const termsList = await response.json();

    // Kosongkan lagi dan isi dengan data baru
    masaSel.innerHTML = '<option disabled selected value="">Pilih</option>';
    termsList.forEach(term => {
      const option = document.createElement('option');
      // Format teksnya di sini, misal: "5 tahun"
      option.textContent = `${term} tahun`;
      masaSel.appendChild(option);
    });

    masaSel.disabled = false; // Aktifkan kembali dropdown

  } catch (error) {
    console.error(error);
    masaSel.innerHTML = '<option disabled selected value="">Gagal memuat</option>';
  }
}

// Tambahkan event listener untuk memanggil fungsi baru saat produk berubah
produkSel.addEventListener('change', e => {
  updateMasaOptionsFromSheet(e.target.value);
});

// --- Input restrictions & formatting ---
// Uang Pertanggungan: angka saja + thousand separator saat mengetik
const upField = kalkulatorContainer.querySelector('#up');
const nfID = new Intl.NumberFormat('id-ID');
upField.addEventListener('input', () => {
    const digits = upField.value.replace(/\D/g,'');
    upField.value = digits ? nfID.format(Number(digits)) : '';
});

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
    ['nama','Nama wajib diisi'],
    ['wa','Nomor WA wajib diisi'],
    ['email','Email wajib diisi'],
    ['gender','Jenis kelamin wajib dipilih'],
    ['dob','Tanggal lahir wajib diisi'],
    ['smoke','Status merokok wajib dipilih'],
    ['produk','Nama produk wajib dipilih'],
    ['up','Uang pertanggungan wajib diisi'],
    ['masa','Masa pembayaran wajib dipilih']
    ];
    required.forEach(function(item){
    var id=item[0], msg=item[1];
    var el = kalkulatorContainer.querySelector('#' + id);
    var val = (el && (el.value||'').trim()) || '';
    if(!val){ ok=false; addError(id,msg); }
    });
    var upDigits = (kalkulatorContainer.querySelector('#up').value||'').replace(/\D/g,'');
    if(!upDigits || Number(upDigits) <= 0){ ok=false; addError('up','Masukkan angka lebih dari 0'); }
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
    const upVal = v('up');
    kalkulatorContainer.querySelector('#s_up').textContent = upVal ? ('Rp ' + upVal) : '-';
    kalkulatorContainer.querySelector('#s_masa').textContent = selText('masa') || '-';
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

// Fungsi baru untuk mengambil daftar produk dari Google Sheet dan mengisinya ke dropdown
async function populateProductDropdown() {
  const productSelect = kalkulatorContainer.querySelector('#produk');
  // Beri tahu pengguna bahwa data sedang dimuat
  productSelect.disabled = true;
  productSelect.options[0].textContent = 'Memuat produk...';

  try {
    const url = new URL('https://script.google.com/macros/s/AKfycbxX9Y5LpmshAp32UPVJs4VkgfWXVd64SvISBpzxVpDiHItyiZJBJcW9KWsTbVa8zyArIg/exec');
    url.searchParams.set('type', 'getProducts');
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Gagal mengambil daftar produk.');
    }
    
    const productList = await response.json();

    // Kembalikan ke teks "Pilih" dan aktifkan kembali dropdown
    productSelect.options[0].textContent = 'Pilih';
    productSelect.disabled = false;
    
    // Isi dropdown dengan pilihan produk dari Google Sheet
    productList.forEach(productName => {
      const option = document.createElement('option');
      option.value = productName;
      option.textContent = productName;
      productSelect.appendChild(option);
    });

  } catch (error) {
    console.error(error);
    // Tampilkan pesan error jika gagal
    productSelect.options[0].textContent = 'Gagal Memuat';
  }
}

// Panggil fungsi ini saat seluruh konten halaman HTML sudah siap
document.addEventListener('DOMContentLoaded', populateProductDropdown);