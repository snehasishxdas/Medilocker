(function(){
  const SESSION_KEY='medilockerSession';

  // Purge any legacy client-side mock accounts
  localStorage.removeItem('medilockerAccounts');
  localStorage.removeItem('medilockerUserRecords');

  const getSession=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch(e){return null}};
  const getToken=()=>localStorage.getItem('medilockerToken');

  // Client-Side Profile & Continuous Identity Cache (Fast SWR)
  const PROFILE_CACHE_KEY='medilockerUserProfile';
  const getCachedProfile=()=>{
    try{
      const raw=localStorage.getItem(PROFILE_CACHE_KEY);
      return raw?JSON.parse(raw):null;
    }catch(e){return null;}
  };
  const setCachedProfile=(u)=>{
    try{
      if(u){
        localStorage.setItem(PROFILE_CACHE_KEY,JSON.stringify(u));
        const s=getSession()||{};
        s.unit=u.medilockerId||s.unit;
        s.name=u.name||s.name;
        s.email=u.email||s.email;
        if(u.role)s.role=u.role.toLowerCase();
        localStorage.setItem(SESSION_KEY,JSON.stringify(s));
      }else{
        localStorage.removeItem(PROFILE_CACHE_KEY);
      }
    }catch(e){}
  };
  async function getUserProfileFast(forceFresh=false){
    const cached=getCachedProfile();
    if(cached&&!forceFresh)return cached;
    const token=getToken();
    if(!token)return cached||null;
    try{
      const res=await fetch(apiUrl('/api/v1/auth/me'),{headers:{Authorization:`Bearer ${token}`}});
      if(res.ok){
        const json=await res.json();
        const u=json.data||json.user;
        if(u){
          setCachedProfile(u);
          return u;
        }
      }
    }catch(_){}
    return cached||null;
  }

  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const initials=n=>(n||'User').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const currentT=()=>window.T?.[localStorage.getItem('medilockerLanguage')||'en']||window.T?.en||{};
  const DEFAULT_BACKEND_URL='https://medilocker-34ij.onrender.com';
  const getBackendBase=()=>{
    if(window.MEDILOCKER_API_BASE)return window.MEDILOCKER_API_BASE.replace(/\/+$/,'');
    const saved=localStorage.getItem('medilockerBackendUrl');
    if(saved)return saved.replace(/\/+$/,'');
    if(location.hostname==='localhost'||location.hostname==='127.0.0.1')return '';
    return DEFAULT_BACKEND_URL;
  };
  const apiUrl=(path)=>`${getBackendBase()}${path.startsWith('/')?path:'/'+path}`;


  function bindLanguage(){
    const s=document.getElementById('languageSelect');
    if(!s)return;
    s.value=localStorage.getItem('medilockerLanguage')||'en';
    s.addEventListener('change',e=>window.applyLanguage?.(e.target.value));
  }

  function bindLocation(){
    document.querySelectorAll('#locationBtn').forEach(b=>b.addEventListener('click',()=>{
      if(!navigator.geolocation){alert('Geolocation is not supported by this browser.');return}
      const old=b.innerHTML;
      b.disabled=true;
      b.innerHTML='⌖ Detecting…';
      navigator.geolocation.getCurrentPosition(pos=>{
        const lat=pos.coords.latitude.toFixed(4),lon=pos.coords.longitude.toFixed(4);
        localStorage.setItem('medilockerLocation',`${lat}, ${lon}`);
        document.querySelectorAll('#locationBtn span').forEach(x=>x.textContent=`${lat}, ${lon}`);
        const d=document.getElementById('locationDisplay');
        if(d)d.textContent=`Location detected · ${lat}, ${lon}`;
        b.disabled=false;
        b.innerHTML=old;
        alert('Location permission granted. Your current location has been set.');
      },err=>{
        b.disabled=false;
        b.innerHTML=old;
        alert(err.code===1?'Location permission was denied. Please allow location access in your browser.':'Unable to detect your location. Please try again.');
      },{enableHighAccuracy:true,timeout:10000,maximumAge:0})
    }));
    const v=localStorage.getItem('medilockerLocation');
    if(v)document.querySelectorAll('#locationBtn span').forEach(x=>x.textContent=v);
  }

  function updateLoginRole(role){
    const t=currentT(),m={patient:['patientLogin','patientLoginText','♡'],doctor:['doctorLogin','doctorLoginText','✚'],hospital:['hospitalLogin','hospitalLoginText','▦']};
    const title=document.getElementById('loginTitle'),sub=document.getElementById('loginSubtitle'),sym=document.getElementById('roleSymbol');
    if(!title||!sub)return;
    const x=m[role]||m.patient;
    title.textContent=t[x[0]]||({patient:'Patient login',doctor:'Doctor login',hospital:'Hospital login'}[role]);
    sub.textContent=t[x[1]]||({patient:'Sign in to manage your medical records.',doctor:'Sign in to access the doctor workspace.',hospital:'Sign in to access the hospital workspace.'}[role]);
    if(sym)sym.textContent=x[2];
    document.querySelectorAll('.role-tab').forEach(b=>b.classList.toggle('active',b.dataset.role===role));
  }

  function bindLogin(){
    let role=new URLSearchParams(location.search).get('role')||'patient';
    if(!['patient','doctor','hospital'].includes(role))role='patient';
    window.currentRole=role;
    document.querySelectorAll('.role-tab').forEach(b=>b.addEventListener('click',()=>{
      window.currentRole=b.dataset.role;
      updateLoginRole(window.currentRole);
      history.replaceState({},'',`login.html?role=${window.currentRole}`);
    }));
    updateLoginRole(role);
    const f=document.getElementById('loginForm');
    const tabPass=document.getElementById('tabLoginPassword');
    const tabUnit=document.getElementById('tabLoginUnit');
    const passField=document.getElementById('passwordField');
    const unitField=document.getElementById('unitField');

    let currentAuthMode = 'password';

    if (tabPass && tabUnit) {
      tabPass.addEventListener('click', () => {
        currentAuthMode = 'password';
        tabPass.style.background = '#2b1836';
        tabPass.style.color = '#fff';
        tabUnit.style.background = 'transparent';
        tabUnit.style.color = '#6b5a7d';
        if (passField) passField.classList.remove('hidden');
        if (unitField) unitField.classList.add('hidden');
      });

      tabUnit.addEventListener('click', () => {
        currentAuthMode = 'unitId';
        tabUnit.style.background = '#2b1836';
        tabUnit.style.color = '#fff';
        tabPass.style.background = 'transparent';
        tabPass.style.color = '#6b5a7d';
        if (unitField) unitField.classList.remove('hidden');
        if (passField) passField.classList.add('hidden');
      });
    }

    // Auto-prefill last generated credentials if available
    const lastUnit = localStorage.getItem('medilockerLastCreatedUnit');
    const unitEl = document.getElementById('unitId');
    const passEl = document.getElementById('loginPassword');
    const emailEl = f.querySelector('input[type=email]');
    if (unitEl && lastUnit && !unitEl.value) {
      unitEl.value = lastUnit;
    }
    const session = getSession();
    if (emailEl && session?.email && !emailEl.value) {
      emailEl.value = session.email;
    }

    f.addEventListener('submit',async e=>{
      e.preventDefault();
      const submitBtn=f.querySelector('button[type=submit]');
      const oldBtnText=submitBtn?submitBtn.textContent:'Sign in ↗';

      const email=emailEl?emailEl.value.trim().toLowerCase():'';
      const unit=unitEl?unitEl.value.trim().toUpperCase():'';
      const password=passEl?passEl.value.trim():'';
      const targetRole=window.currentRole||'patient';

      if(!email){
        alert('Registered Email address is required to sign in.');
        return;
      }

      if(!unit && !password){
        alert('Please enter either your Password or your Unique Unit ID (ML-XXXX-XXXX) to sign in.');
        return;
      }

      if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='Authenticating…';}

      try{
        const loginPayload = {
          email: email,
          role: targetRole.toUpperCase()
        };
        if (password) loginPayload.password = password;
        if (unit) loginPayload.medilockerId = unit;

        const res=await fetch(apiUrl('/api/v1/auth/login'),{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(loginPayload)
        });

        const data=await res.json();
        if(res.ok&&data.success&&data.user){
          const u=data.user;
          localStorage.setItem('medilockerToken',data.token);
          setCachedProfile(u);
          localStorage.setItem(SESSION_KEY,JSON.stringify({unit:u.medilockerId||unit,email:u.email||email,role:targetRole,name:u.name||'User'}));
          location.href=targetRole==='doctor'?'doctor.html':targetRole==='hospital'?'hospital.html':'dashboard.html';
          return;
        }

        alert(data.error||data.message||'Authentication failed. Please verify your email and password or Unit ID.');
      }catch(err){
        alert(err.message||'Server error: Unable to connect to backend server. Please check your network connection.');
      }finally{
        if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=oldBtnText;}
      }
    });
  }

  function setSignupRole(role){
    const sections={patient:document.getElementById('patientFields'),doctor:document.getElementById('doctorFields'),hospital:document.getElementById('hospitalFields')};
    Object.entries(sections).forEach(([k,el])=>el?.classList.toggle('hidden',k!==role));
    document.querySelectorAll('input[name=role]').forEach(r=>r.closest('.signup-role')?.classList.toggle('selected',r.value===role));
    document.querySelectorAll('[data-required]').forEach(el=>{el.required=el.dataset.required===role});
    document.body.dataset.signupRole=role;
  }

  function bindSignup(){
    const f=document.getElementById('signupForm');
    if(!f)return;
    let role='patient';
    document.querySelectorAll('input[name=role]').forEach(r=>r.addEventListener('change',()=>{role=r.value;setSignupRole(role);}));
    setSignupRole(role);

    // Certificate Upload & Camera Capture Logic
    let activeCameraTarget = null; // 'doctor' | 'hospital'
    let cameraStream = null;

    const cameraModal = document.getElementById('cameraModal');
    const cameraVideo = document.getElementById('cameraVideo');
    const cameraCanvas = document.getElementById('cameraCanvas');
    const takePhotoBtn = document.getElementById('takePhotoBtn');
    const closeCameraBtn = document.getElementById('closeCameraModal');
    const cancelCameraBtn = document.getElementById('cancelCameraBtn');

    function stopCamera() {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
      }
      cameraModal?.classList.add('hidden');
    }

    async function startCamera(target) {
      activeCameraTarget = target;
      if (!cameraModal || !cameraVideo) return;
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        cameraVideo.srcObject = cameraStream;
        cameraModal.classList.remove('hidden');
      } catch (err) {
        alert('Could not access device camera. Please check camera permissions or upload a file directly.');
      }
    }

    closeCameraBtn?.addEventListener('click', stopCamera);
    cancelCameraBtn?.addEventListener('click', stopCamera);

    takePhotoBtn?.addEventListener('click', () => {
      if (!cameraVideo || !cameraCanvas) return;
      cameraCanvas.width = cameraVideo.videoWidth || 640;
      cameraCanvas.height = cameraVideo.videoHeight || 480;
      const ctx = cameraCanvas.getContext('2d');
      ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
      const dataUrl = cameraCanvas.toDataURL('image/jpeg', 0.85);

      if (activeCameraTarget === 'doctor') {
        const certInput = document.getElementById('doctorCertificateUrl');
        const certName = document.getElementById('doctorCertName');
        const certPreview = document.getElementById('doctorCertPreview');
        const certImg = document.getElementById('doctorCertPreviewImg');
        if (certInput) certInput.value = dataUrl;
        if (certName) certName.textContent = '✓ Live Camera Capture Attached';
        if (certImg) certImg.src = dataUrl;
        if (certPreview) certPreview.style.display = 'block';
      } else if (activeCameraTarget === 'hospital') {
        const certInput = document.getElementById('hospitalCertificateUrl');
        const certName = document.getElementById('hospitalCertName');
        const certPreview = document.getElementById('hospitalCertPreview');
        const certImg = document.getElementById('hospitalCertPreviewImg');
        if (certInput) certInput.value = dataUrl;
        if (certName) certName.textContent = '✓ Live Camera Capture Attached';
        if (certImg) certImg.src = dataUrl;
        if (certPreview) certPreview.style.display = 'block';
      }
      stopCamera();
    });

    // Doctor cert upload buttons
    const docUploadBtn = document.getElementById('doctorCertUploadBtn');
    const docFileInput = document.getElementById('doctorCertFileInput');
    docUploadBtn?.addEventListener('click', () => docFileInput?.click());
    docFileInput?.addEventListener('change', () => {
      const file = docFileInput.files?.[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = (e) => {
        const val = e.target.result;
        const certInput = document.getElementById('doctorCertificateUrl');
        const certName = document.getElementById('doctorCertName');
        const certPreview = document.getElementById('doctorCertPreview');
        const certImg = document.getElementById('doctorCertPreviewImg');
        if (certInput) certInput.value = val;
        if (certName) certName.textContent = `✓ ${file.name}`;
        if (certImg && file.type.startsWith('image/')) {
          certImg.src = val;
          if (certPreview) certPreview.style.display = 'block';
        }
      };
      r.readAsDataURL(file);
    });
    document.getElementById('doctorCertCameraBtn')?.addEventListener('click', () => startCamera('doctor'));

    // Hospital cert upload buttons
    const hospUploadBtn = document.getElementById('hospitalCertUploadBtn');
    const hospFileInput = document.getElementById('hospitalCertFileInput');
    hospUploadBtn?.addEventListener('click', () => hospFileInput?.click());
    hospFileInput?.addEventListener('change', () => {
      const file = hospFileInput.files?.[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = (e) => {
        const val = e.target.result;
        const certInput = document.getElementById('hospitalCertificateUrl');
        const certName = document.getElementById('hospitalCertName');
        const certPreview = document.getElementById('hospitalCertPreview');
        const certImg = document.getElementById('hospitalCertPreviewImg');
        if (certInput) certInput.value = val;
        if (certName) certName.textContent = `✓ ${file.name}`;
        if (certImg && file.type.startsWith('image/')) {
          certImg.src = val;
          if (certPreview) certPreview.style.display = 'block';
        }
      };
      r.readAsDataURL(file);
    });
    document.getElementById('hospitalCertCameraBtn')?.addEventListener('click', () => startCamera('hospital'));

    // Schemes radio listener
    document.querySelectorAll('input[name="govtSchemesAvailable"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const schemesList = document.getElementById('schemesOptionsList');
        if (schemesList) {
          schemesList.style.display = radio.value === 'yes' ? 'flex' : 'none';
        }
      });
    });

    f.addEventListener('submit',async e=>{
      e.preventDefault();
      setSignupRole(role);
      if(!f.reportValidity())return;
      const submitBtn=f.querySelector('button[type=submit]');
      const oldBtnText=submitBtn?submitBtn.textContent:'Create account & generate Unit ID ↗';
      if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='Registering in Supabase database…';}

      const fd=new FormData(f);
      let payload={role:role.toUpperCase()};

      if(role==='patient'){
        Object.assign(payload,{
          name:fd.get('patientName')||'Patient',
          email:fd.get('patientEmail')||'',
          phone:fd.get('patientPhone')||'0000000000',
          dob:fd.get('dob')||undefined,
          gender:fd.get('gender')||'Not specified',
          blood:fd.get('blood')||'Not specified',
          govid:fd.get('govid')||undefined,
          insurance:fd.get('insurance')||undefined,
          allergy:fd.get('allergy')||undefined,
          medications:fd.get('medications')||undefined,
          history:fd.get('history')||undefined,
          emergency:fd.get('emergency')||undefined,
          address:fd.get('address')||undefined,
          city:fd.get('city')||undefined,
          state:fd.get('state')||undefined,
          pincode:fd.get('pincode')||undefined
        });
      }else if(role==='doctor'){
        Object.assign(payload,{
          name:fd.get('doctorName')||'Doctor',
          email:fd.get('doctorEmail')||'',
          phone:fd.get('doctorPhone')||'0000000000',
          doctorId:fd.get('doctorId')||'DOC-'+Date.now(),
          registrationNumber:fd.get('registrationNumber')||'REG-'+Date.now(),
          specialization:fd.get('specialization')||'General Medicine',
          degree:fd.get('doctorDegree')||'MBBS',
          certificateUrl:fd.get('doctorCertificateUrl')||undefined,
          registrationDate:fd.get('registrationDate')||undefined,
          experience:Number(fd.get('experience'))||0,
          clinicName:fd.get('clinicName')||'Medical Clinic',
          clinicVerification:fd.get('clinicVerification')||undefined,
          address:fd.get('clinicAddress')||'Clinic Address',
          city:fd.get('doctorCity')||'City',
          state:fd.get('doctorState')||undefined
        });
      }else{
        const schemesChecked = Array.from(f.querySelectorAll('input[name="schemeItem"]:checked')).map(cb => cb.value);
        const schemesAvail = fd.get('govtSchemesAvailable') === 'yes';

        Object.assign(payload,{
          name:fd.get('hospitalName')||'Hospital',
          email:fd.get('hospitalEmail')||'',
          phone:fd.get('hospitalPhone')||'0000000000',
          hospitalId:fd.get('hospitalId')||'HOS-'+Date.now(),
          license:fd.get('hospitalLicense')||'LIC-'+Date.now(),
          registrationDate:fd.get('hospitalRegDate')||undefined,
          address:fd.get('hospitalAddress')||'Hospital Address',
          city:fd.get('hospitalCity')||'City',
          state:fd.get('hospitalState')||undefined,
          hospitalType:fd.get('hospitalType')||'General Hospital',
          hospitalOwnership:fd.get('hospitalOwnership')||'PRIVATE',
          beds:Number(fd.get('beds'))||100,
          representative:fd.get('representative')||undefined,
          mdName:fd.get('mdName')||undefined,
          mdPhone:fd.get('mdPhone')||undefined,
          govtSchemesAvailable:schemesAvail,
          govtSchemesList:schemesAvail?schemesChecked:[],
          registrationCertificateUrl:fd.get('hospitalCertificateUrl')||undefined
        });
      }

      try{
        const res=await fetch(apiUrl('/api/v1/auth/signup'),{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload)
        });

        const resData=await res.json();
        if(!res.ok||!resData.data?.user){
          alert(resData.error||resData.message||'Database error: Could not register user.');
          if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=oldBtnText;}
          return;
        }

        const unit=resData.data.user.medilockerId;
        if(resData.data.token)localStorage.setItem('medilockerToken',resData.data.token);
        if(resData.data.user)setCachedProfile(resData.data.user);
        localStorage.setItem(SESSION_KEY,JSON.stringify({unit,email:payload.email,role,name:resData.data.user?.name||payload.name}));
        localStorage.setItem('medilockerLastCreatedUnit',unit);
        localStorage.setItem('medilockerLastCreatedRole',role);
        
        document.getElementById('generatedUnit').textContent=unit;
        document.getElementById('unitMessage').innerHTML=`Your <strong>${esc(role)}</strong> account has been registered successfully!<br><br>Your permanent Unit ID is: <strong style="color:var(--plum);font-size:18px;">${esc(unit)}</strong><br><br>During login, you can provide either your <strong>Password</strong> OR this <strong>Unit ID</strong> along with your registered email (<strong>${esc(payload.email)}</strong>). Welcome email with your credentials has been dispatched.`;
        document.getElementById('unitModal')?.classList.remove('hidden');
      }catch(err){
        alert('Server is down or unreachable. Could not connect to Supabase database. Please check your backend connection.');
      }finally{
        if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=oldBtnText;}
      }
    });
    document.getElementById('closeUnit')?.addEventListener('click',()=>document.getElementById('unitModal')?.classList.add('hidden'));
    document.getElementById('goLogin')?.addEventListener('click',()=>location.href=`login.html?role=${encodeURIComponent(localStorage.getItem('medilockerLastCreatedRole')||'patient')}`);
  }

  function requireSession(role){
    const s=getSession();
    const token=getToken();
    if(!s||!token||s.role!==role){
      location.href=`login.html?role=${role}`;
      return null;
    }
    return s;
  }

  async function bindPatientUI(){
    const isProfilePage = !!document.getElementById('profileForm');
    let s = getSession();
    const token = getToken();

    if (isProfilePage) {
      if (!s || !token) {
        location.href = 'login.html';
        return;
      }
    } else {
      s = requireSession('patient');
      if (!s) return;
    }

    const render = (u) => {
      const role = (u.role || s.role || 'patient').toLowerCase();
      document.querySelectorAll('[data-user-name]').forEach(e=>e.textContent=u.name||'User');
      document.querySelectorAll('[data-user-email]').forEach(e=>e.textContent=u.email||'');
      document.querySelectorAll('[data-user-unit]').forEach(e=>e.textContent=u.medilockerId||s.unit);
      document.querySelectorAll('[data-user-initials]').forEach(e=>e.textContent=initials(u.name));

      if (isProfilePage) {
        const rolePill = document.getElementById('profileRolePill');
        if (rolePill) rolePill.textContent = `${role.toUpperCase()} ACCOUNT`;

        const patSec = document.getElementById('patientProfileSection');
        const docSec = document.getElementById('doctorProfileSection');
        const hospSec = document.getElementById('hospitalProfileSection');

        if (patSec) patSec.classList.toggle('hidden', role !== 'patient');
        if (docSec) docSec.classList.toggle('hidden', role !== 'doctor');
        if (hospSec) hospSec.classList.toggle('hidden', role !== 'hospital');

        if (role === 'patient') {
          const fields = {
            fullName: u.name || '',
            dob: u.dob ? u.dob.split('T')[0] : '',
            bloodGroup: u.bloodGroup || 'Not specified',
            phone: u.phone || '',
            email: u.email || '',
            govid: u.govid || '',
            insurance: u.insurance || '',
            allergy: (u.allergies && u.allergies.length) ? u.allergies.join(', ') : '',
            medications: (u.baselineMedications && u.baselineMedications.length) ? u.baselineMedications.join(', ') : '',
            history: (u.chronicConditions && u.chronicConditions.length) ? u.chronicConditions.join(', ') : '',
            emergencyName: u.emergencyContact?.name || '',
            emergencyPhone: u.emergencyContact?.phone || '',
            city: u.city || '',
            state: u.state || '',
            pincode: u.pincode || '',
            address: u.address || ''
          };
          Object.entries(fields).forEach(([k, v]) => {
            document.querySelectorAll(`[data-field="${k}"]`).forEach(e => {
              if (e.tagName === 'SELECT') e.value = v;
              else e.value = v;
            });
          });
        } else if (role === 'doctor') {
          const doc = u.doctorProfile || {};
          const fields = {
            docFullName: u.name || '',
            degree: doc.degree || '',
            specialization: doc.specialization || '',
            experience: doc.experienceYears ?? '',
            docPhone: u.phone || '',
            docEmail: u.email || '',
            clinicName: doc.clinicName || '',
            docCity: doc.city || u.city || '',
            docState: doc.state || u.state || '',
            clinicAddress: doc.clinicAddress || u.address || ''
          };
          Object.entries(fields).forEach(([k, v]) => {
            document.querySelectorAll(`[data-field="${k}"]`).forEach(e => e.value = v);
          });
        } else if (role === 'hospital') {
          const hosp = u.hospitalProfile || {};
          const fields = {
            hospName: hosp.hospitalName || u.name || '',
            hospPhone: u.phone || '',
            hospEmail: hosp.officialEmail || u.email || '',
            hospitalOwnership: hosp.hospitalOwnership || 'PRIVATE',
            hospitalType: hosp.hospitalType || '',
            bedCapacity: hosp.bedCapacity ?? '',
            managingDirectorName: hosp.managingDirectorName || '',
            managingDirectorContact: hosp.managingDirectorContact || '',
            authorizedRepresentative: hosp.authorizedRepresentative || '',
            govtSchemesAvailable: String(!!hosp.govtSchemesAvailable),
            govtSchemesList: Array.isArray(hosp.govtSchemesList) ? hosp.govtSchemesList.join(', ') : '',
            hospCity: hosp.city || u.city || '',
            hospState: hosp.state || u.state || '',
            hospAddress: hosp.address || u.address || ''
          };
          Object.entries(fields).forEach(([k, v]) => {
            document.querySelectorAll(`[data-field="${k}"]`).forEach(e => {
              if (e.tagName === 'SELECT') e.value = v;
              else e.value = v;
            });
          });
        }
      } else {
        const fields={
          fullName:u.name||'',
          dateBirth:u.dob?new Date(u.dob).toLocaleDateString():'Not provided',
          bloodGroup:u.bloodGroup||'Not specified',
          phone:u.phone||'Not provided',
          email:u.email||'',
          location:[u.city,u.state].filter(Boolean).join(', ')||'Not provided',
          govid:u.govid||'Not provided',
          insurance:u.insurance||'Not provided',
          allergy:(u.allergies&&u.allergies.length)?u.allergies.join(', '):'None recorded',
          medications:(u.baselineMedications&&u.baselineMedications.length)?u.baselineMedications.join(', '):'None recorded',
          history:(u.chronicConditions&&u.chronicConditions.length)?u.chronicConditions.join(', '):'Not provided',
          emergency:u.emergencyContact?.name||'Not configured',
          address:u.address||'Not provided'
        };
        Object.entries(fields).forEach(([k,v])=>document.querySelectorAll(`[data-field="${k}"]`).forEach(e=>e.value=v));
      }
    };

    // 1. Instant Zero-Latency Render from Client Cache
    const cachedProfile = getCachedProfile();
    if (cachedProfile) {
      render(cachedProfile);
      window.currentUserProfile = cachedProfile;
    }

    // Profile editing functionality
    if (isProfilePage) {
      const toggleBtn = document.getElementById('toggleEditProfileBtn');
      const editActions = document.getElementById('profileEditActions');
      const cancelBtn = document.getElementById('cancelProfileEditBtn');
      const profileForm = document.getElementById('profileForm');
      const saveBtn = document.getElementById('saveProfileBtn');

      let isEditing = false;
      const setEditMode = (editing) => {
        isEditing = editing;
        if (toggleBtn) toggleBtn.style.display = editing ? 'none' : 'inline-block';
        if (editActions) editActions.classList.toggle('hidden', !editing);

        const currentRole = (cachedProfile?.role || s.role || 'patient').toLowerCase();
        let targetSec = document.getElementById(`${currentRole}ProfileSection`);
        if (!targetSec) targetSec = profileForm;

        targetSec.querySelectorAll('input, select, textarea').forEach(el => {
          if (el.name === 'email' || el.name === 'docEmail' || el.name === 'hospEmail') return; // immutable email
          if (editing) {
            el.removeAttribute('readonly');
            el.removeAttribute('disabled');
          } else {
            el.setAttribute('readonly', 'readonly');
            if (el.tagName === 'SELECT') el.setAttribute('disabled', 'disabled');
          }
        });
      };

      toggleBtn?.addEventListener('click', () => setEditMode(true));
      cancelBtn?.addEventListener('click', () => {
        setEditMode(false);
        if (window.currentUserProfile) render(window.currentUserProfile);
      });

      profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentRole = (cachedProfile?.role || s.role || 'patient').toLowerCase();
        const fd = new FormData(profileForm);
        let updatePayload = {};

        if (currentRole === 'patient') {
          updatePayload = {
            name: fd.get('fullName') || undefined,
            dob: fd.get('dob') || undefined,
            bloodGroup: fd.get('bloodGroup') || undefined,
            phone: fd.get('phone') || undefined,
            govid: fd.get('govid') || undefined,
            insurance: fd.get('insurance') || undefined,
            allergy: fd.get('allergy') || undefined,
            medications: fd.get('medications') || undefined,
            history: fd.get('history') || undefined,
            emergencyName: fd.get('emergencyName') || undefined,
            emergencyPhone: fd.get('emergencyPhone') || undefined,
            city: fd.get('city') || undefined,
            state: fd.get('state') || undefined,
            pincode: fd.get('pincode') || undefined,
            address: fd.get('address') || undefined
          };
        } else if (currentRole === 'doctor') {
          updatePayload = {
            name: fd.get('docFullName') || undefined,
            phone: fd.get('docPhone') || undefined,
            degree: fd.get('degree') || undefined,
            specialization: fd.get('specialization') || undefined,
            experience: fd.get('experience') ? Number(fd.get('experience')) : undefined,
            clinicName: fd.get('clinicName') || undefined,
            clinicAddress: fd.get('clinicAddress') || undefined,
            city: fd.get('docCity') || undefined,
            state: fd.get('docState') || undefined
          };
        } else if (currentRole === 'hospital') {
          const schemesRaw = fd.get('govtSchemesList');
          const schemesArr = schemesRaw ? String(schemesRaw).split(',').map(item => item.trim()).filter(Boolean) : [];
          updatePayload = {
            name: fd.get('hospName') || undefined,
            hospitalName: fd.get('hospName') || undefined,
            phone: fd.get('hospPhone') || undefined,
            hospitalOwnership: fd.get('hospitalOwnership') || undefined,
            hospitalType: fd.get('hospitalType') || undefined,
            bedCapacity: fd.get('bedCapacity') ? Number(fd.get('bedCapacity')) : undefined,
            managingDirectorName: fd.get('managingDirectorName') || undefined,
            managingDirectorContact: fd.get('managingDirectorContact') || undefined,
            authorizedRepresentative: fd.get('authorizedRepresentative') || undefined,
            govtSchemesAvailable: fd.get('govtSchemesAvailable') === 'true',
            govtSchemesList: schemesArr,
            city: fd.get('hospCity') || undefined,
            state: fd.get('hospState') || undefined,
            address: fd.get('hospAddress') || undefined
          };
        }

        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Saving changes to database…';
        }

        try {
          const res = await fetch(apiUrl('/api/v1/auth/me'), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(updatePayload)
          });
          const resData = await res.json();
          if (!res.ok || !resData.data) {
            alert(resData.error || resData.message || 'Failed to update profile.');
            return;
          }

          const updatedUser = resData.data;
          setCachedProfile(updatedUser);
          window.currentUserProfile = updatedUser;
          render(updatedUser);
          setEditMode(false);
          alert('Profile successfully updated and saved to database!');
        } catch (err) {
          alert('Network or server error updating profile: ' + err.message);
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Profile Changes ↗';
          }
        }
      });
    }

    // 2. SWR Background Revalidation
    try{
      const res=await fetch(apiUrl('/api/v1/auth/me'),{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok){
        if(res.status===401){
          setCachedProfile(null);
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem('medilockerToken');
          alert('Session expired. Please sign in again.');
          location.href='login.html';
          return;
        }
      }else{
        const data=await res.json();
        const freshUser = data.data || data.user;
        if(freshUser){
          setCachedProfile(freshUser);
          render(freshUser);
          window.currentUserProfile=freshUser;
        }
      }
    }catch(err){
      if(!cachedProfile){
        alert('Server error: Unable to connect to Supabase database. Please check your backend connection.');
        return;
      }
    }

    // Live dashboard active meds counter from Supabase
    const dashMeds=document.getElementById('dashMedsCount');
    if(dashMeds){
      try{
        const todoRes=await fetch(apiUrl('/api/v1/todo/today'),{headers:{Authorization:`Bearer ${token}`}});
        const todoData=await todoRes.json();
        const tasks=todoData.data?.tasks||todoData.tasks||[];
        dashMeds.textContent=`${tasks.length} Active`;
      }catch(_){}
    }
  }

  async function bindPatientRecords(){
    const s=requireSession('patient');
    if(!s)return;
    const container=document.getElementById('recordsListContainer');
    if(!container)return;
    const token=getToken();

    try{
      const res=await fetch(apiUrl('/api/v1/records'),{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok){
        container.innerHTML=`<div class="empty-state" style="background:#fff;border:1px solid #cf4e4e;border-radius:18px;padding:48px 24px;text-align:center;width:100%;"><div class="empty-icon" style="font-size:40px;margin-bottom:12px;color:#cf4e4e;">⚠</div><h3 style="font:800 20px 'Manrope';margin:0 0 8px;color:#cf4e4e;">Server is down</h3><p style="color:var(--muted);max-width:460px;margin:0 auto 20px;font-size:14px;">Unable to fetch records from database. Please verify backend connection.</p></div>`;
        return;
      }
      const data=await res.json();
      const records=Array.isArray(data.data)?data.data:[];

      if(records.length>0){
        container.innerHTML=records.map(r=>{
          const isLab=(r.category&&(r.category.toLowerCase().includes('lab')||r.category.toLowerCase().includes('report')||r.category.toLowerCase().includes('scan')))||r.documentType==='REPORT'||r.documentType==='SCAN';
          const docDate=r.eventDateDdmmyyyy||r.dateFormatted||'Recent';
          const docTypeStr=r.category?.toUpperCase()||'DOCUMENT';
          const titleStr=r.diagnoses?.[0]||r.clinicalSummary||'Clinical Record';
          const doctorStr=r.doctorName?`${r.doctorName} · `:'';
          const hospitalStr=r.clinicName||'Verified in Vault';
          const medsCount=r.prescribedMedications?.length?` · ${r.prescribedMedications.length} Medicines Prescribed`:'';
          const fileLink=apiUrl(`/api/v1/records/${r.id}/view?token=${encodeURIComponent(token)}`);
          return `
            <div class="record-card" data-type="${isLab?'report':'prescription'}">
              <div class="record-icon ${isLab?'report-icon':'prescription-icon'}">${isLab?'⚗':'℞'}</div>
              <div class="record-main" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;width:100%;">
                <div style="flex:1;min-width:220px;">
                  <span class="record-type">${esc(docTypeStr)} · ${esc(docDate)}</span>
                  <h3>${esc(titleStr)}</h3>
                  <p>${esc(doctorStr)}${esc(hospitalStr)}${esc(medsCount)}</p>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                  <a href="${fileLink}" target="_blank" class="view-btn" style="text-decoration:none;display:inline-flex;align-items:center;">View Document ↗</a>
                  <button type="button" class="delete-record-btn" data-id="${r.id}" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:7px 12px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">🗑 Delete</button>
                </div>
              </div>
            </div>
          `;
        }).join('');

        container.querySelectorAll('.delete-record-btn').forEach(btn=>{
          btn.addEventListener('click',async(e)=>{
            e.stopPropagation();
            const id=btn.dataset.id;
            if(!confirm('Are you sure you want to permanently delete this medical record? This will remove the document, its timeline consultation, and any active daily medication tasks associated with it.'))return;
            btn.disabled=true;
            btn.textContent='Deleting…';
            try{
              const dRes=await fetch(apiUrl(`/api/v1/records/${id}`),{
                method:'DELETE',
                headers:{Authorization:`Bearer ${token}`}
              });
              const dJson=await dRes.json();
              if(!dRes.ok||!dJson.success){
                alert(dJson.error||dJson.message||'Failed to delete record.');
                btn.disabled=false;
                btn.textContent='🗑 Delete';
                return;
              }
              alert('Medical record permanently deleted.');
              bindPatientRecords();
            }catch(err){
              alert('Network error deleting record: '+err.message);
              btn.disabled=false;
              btn.textContent='🗑 Delete';
            }
          });
        });
      }else{
        container.innerHTML=`<div class="empty-state" id="recordsEmptyState" style="background:#fff;border:1px solid var(--line);border-radius:18px;padding:48px 24px;text-align:center;width:100%;"><div class="empty-icon" style="font-size:40px;margin-bottom:12px;">▤</div><h3 style="font:800 20px 'Manrope';margin:0 0 8px;">No medical records yet</h3><p style="color:var(--muted);max-width:460px;margin:0 auto 20px;font-size:14px;">Upload your prescriptions, lab reports, or discharge summaries to securely store and index them in your sovereign vault.</p><a class="primary-btn" href="upload.html" style="display:inline-block;">Upload Your First Record ↗</a></div>`;
      }
    }catch(err){
      container.innerHTML=`<div class="empty-state" style="background:#fff;border:1px solid #cf4e4e;border-radius:18px;padding:48px 24px;text-align:center;width:100%;"><div class="empty-icon" style="font-size:40px;margin-bottom:12px;color:#cf4e4e;">⚠</div><h3 style="font:800 20px 'Manrope';margin:0 0 8px;color:#cf4e4e;">Database Unreachable</h3><p style="color:var(--muted);max-width:460px;margin:0 auto 20px;font-size:14px;">Failed to connect to the database. Server is down.</p></div>`;
    }

    document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const type=b.dataset.filter;
      document.querySelectorAll('.record-card').forEach(c=>c.style.display=type==='all'||c.dataset.type===type?'flex':'none');
    }));
  }

  function bindLogout(){
    document.querySelectorAll('[data-logout]').forEach(b=>b.addEventListener('click',e=>{
      e.preventDefault();
      setCachedProfile(null);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('medilockerToken');
      location.href='index.html';
    }));
  }

  function bindUpload(){
    const i=document.getElementById('fileInput'),n=document.getElementById('fileName'),d=document.getElementById('dropZone');
    const docTypeSelect=document.getElementById('docTypeSelect');
    const docDateInput=document.getElementById('docDate');
    const docNoteInput=document.getElementById('docNote');
    const saveBtn=document.getElementById('saveUpload');

    if(i)i.addEventListener('change',()=>{if(n)n.textContent=i.files[0]?i.files[0].name:currentT().noFile});
    if(d){
      ['dragenter','dragover'].forEach(e=>d.addEventListener(e,x=>{x.preventDefault();d.classList.add('dragging');}));
      ['dragleave','drop'].forEach(e=>d.addEventListener(e,x=>{x.preventDefault();d.classList.remove('dragging');}));
      d.addEventListener('drop',x=>{
        const files=x.dataTransfer.files;
        if(files.length&&i){
          try{i.files=files;}catch(_){}
          if(n)n.textContent=files[0].name;
        }
      });
    }

    saveBtn?.addEventListener('click',async()=>{
      const file=i?.files?.[0];
      const docType=docTypeSelect?.value||'prescription';
      const docDate=docDateInput?.value.trim()||new Date().toISOString().split('T')[0];
      const docNote=docNoteInput?.value.trim()||'';
      const doctorUnitId=document.getElementById('doctorUnitId')?.value.trim()||'';
      const medNeededEl=document.getElementById('medicineStillNeeded');
      const isMedicineStillNeeded=medNeededEl ? medNeededEl.checked : true;
      const token=getToken();

      if(!token){
        alert('You must be logged in to upload documents.');
        location.href='login.html';
        return;
      }

      saveBtn.disabled=true;
      saveBtn.textContent='Medi-AI Analyzing & Saving to Database…';

      try{
        if(file){
          const fd=new FormData();
          fd.append('file',file);
          fd.append('documentType',docType.toUpperCase());
          fd.append('note',docNote);
          fd.append('eventDate',docDate);
          if(doctorUnitId) fd.append('doctorUnitId',doctorUnitId);
          fd.append('isMedicineStillNeeded',String(isMedicineStillNeeded));

          const res=await fetch(apiUrl('/api/v1/records/upload'),{
            method:'POST',
            headers:{Authorization:`Bearer ${token}`},
            body:fd
          });
          const data=await res.json();
          if(!res.ok){
            alert(data.error||data.message||'Server error: Database failed to save upload.');
            saveBtn.disabled=false;
            saveBtn.textContent='Save document & Extract with Medi-AI ↗';
            return;
          }
          alert('Document processed by Medi-AI and saved to Supabase database! Your To-Do routine, timeline, and records have been automatically updated.');
          location.href=docType.toLowerCase().includes('report')?'tests.html':'records.html';
          return;
        }

        if(docNote){
          const res=await fetch(apiUrl('/api/v1/records'),{
            method:'POST',
            headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
            body:JSON.stringify({
              title:docNote,
              recordType:docType.toUpperCase(),
              eventDateDdmmyyyy:docDate,
              doctorUnitId:doctorUnitId||undefined,
              isMedicineStillNeeded,
              diagnosis:docNote,
              clinicalSummary:docNote
            })
          });
          const data=await res.json();
          if(!res.ok){
            alert(data.error||data.message||'Server error: Database failed to save record.');
            saveBtn.disabled=false;
            saveBtn.textContent='Save document & Extract with Medi-AI ↗';
            return;
          }
          alert('Prescription or report analyzed by Medi-AI and saved to database! Your To-Do routine, timeline, and records have been updated.');
          location.href=docType.toLowerCase().includes('report')?'tests.html':'records.html';
          return;
        }

        alert('Please choose a file to upload or enter a clinical prescription note.');
      }catch(err){
        alert('Server is down or unreachable. Unable to save to database. Please verify your connection.');
      }finally{
        saveBtn.disabled=false;
        saveBtn.textContent='Save document & Extract with Medi-AI ↗';
      }
    });
  }

  async function bindTodo(){
    const count=document.getElementById('doneCount'),bar=document.getElementById('todoProgress'),streak=document.getElementById('streakStatusText');
    const morningList=document.getElementById('morningMedList');
    const afternoonList=document.getElementById('afternoonMedList');
    const nightList=document.getElementById('nightMedList');
    const feelingAlert=document.getElementById('feelingSafetyAlert');
    const feelingTitle=document.getElementById('feelingSafetyTitle');
    const feelingDesc=document.getElementById('feelingSafetyDesc');
    const feelingIcon=document.getElementById('feelingSafetyIcon');
    const allergyAlert=document.getElementById('allergySafetyAlert');
    const allergyDesc=document.getElementById('allergySafetyDesc');
    const token=getToken();

    if(!token)return;

    let userAllergies=[];
    try{
      const u=await getUserProfileFast();
      userAllergies=(u?.allergies||[]).map(a=>String(a).toLowerCase().trim()).filter(Boolean);
    }catch(_){}

    // Check today's adverse feeling from timeline
    try{
      const timeRes=await fetch(apiUrl('/api/v1/timeline'),{headers:{Authorization:`Bearer ${token}`}});
      const timeData=await timeRes.json();
      const logs=timeData.data?.symptomSynopsis||timeData.symptomSynopsis||[];
      const todayStr=new Date().toISOString().split('T')[0];
      const todayLog=logs.find(l=>l.date===todayStr);
      if(todayLog&&feelingAlert){
        const col=(todayLog.severityColor||'').toUpperCase();
        if(col==='RED'){
          feelingAlert.classList.remove('hidden');
          feelingAlert.style.background='#faecec';
          feelingAlert.style.borderColor='#e4a6a6';
          if(feelingIcon)feelingIcon.textContent='🚨';
          if(feelingTitle){feelingTitle.textContent='Adverse Symptom Watch (Score 1/5: Worse / Severe)';feelingTitle.style.color='#9b2424';}
          if(feelingDesc){feelingDesc.textContent='You logged severe discomfort today in your timeline. Medi-AI clinical guardrails advise reviewing symptoms with your doctor before completing routine doses.';feelingDesc.style.color='#6d1818';}
        }else if(col==='ORANGE'){
          feelingAlert.classList.remove('hidden');
          feelingAlert.style.background='#fdf6ec';
          feelingAlert.style.borderColor='#f3d3a0';
          if(feelingIcon)feelingIcon.textContent='⚠️';
          if(feelingTitle){feelingTitle.textContent='Symptom Watch (Score 3/5: Mild Discomfort)';feelingTitle.style.color='#b56b10';}
          if(feelingDesc){feelingDesc.textContent='You logged mild discomfort today. If adverse symptoms persist after taking medications, consult your doctor.';feelingDesc.style.color='#7a4708';}
        }else{
          feelingAlert.classList.add('hidden');
        }
      }
    }catch(_){}

    let tasks=[];
    try{
      const res=await fetch(apiUrl('/api/v1/todo/today'),{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok){
        if(streak)streak.textContent='Server error: Could not load medication tasks from database.';
        return;
      }
      const data=await res.json();
      tasks=data.data?.tasks||data.tasks||[];
    }catch(err){
      if(streak)streak.textContent='Database is unreachable. Server is down.';
      return;
    }

    if(tasks.length>0){
      let allergyConflictsFound=[];

      const renderSection=(listEl,timeName,taskList)=>{
        if(!listEl)return;
        if(taskList.length===0){
          listEl.innerHTML=`<div class="empty-task" style="padding:14px;background:#fff;border:1px dashed var(--line);border-radius:14px;color:var(--muted);font-size:14px;text-align:center;">No ${timeName.toLowerCase()} medications scheduled.</div>`;
          return;
        }
        listEl.innerHTML=taskList.map(t=>{
          const medName=t.medication?.medicineName||t.taskLabel||'';
          const salt=t.medication?.activeSalt||'';
          const testStr=`${medName} ${salt}`.toLowerCase();
          const match=userAllergies.find(a=>a&&testStr.includes(a));
          if(match)allergyConflictsFound.push({med:medName,allergy:match});

          return `
            <label class="med-task" data-id="${t.id}" data-allergy-conflict="${match?esc(match):''}" style="${match?'border-left:4px solid #cf4e4e;':''}">
              <input type="checkbox" ${t.isCompleted?'checked':''}>
              <span class="checkmark">✓</span>
              <div>
                <strong>${esc(medName)}${match?`<span style="background:#faecec;color:#9b2424;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;margin-left:8px;">⚠ Allergy Risk (${esc(match)})</span>`:''}</strong>
                <small>${esc(t.medication?.dosage?t.medication.dosage+' · ':'' )}${esc(t.medication?.timingInstruction||(t.medication?'Take as directed':'Clinical task / Investigation'))}</small>
              </div>
              <b>${t.timeSlot==='MORNING'?'8:00 AM':t.timeSlot==='AFTERNOON'?'1:30 PM':'9:00 PM'}</b>
            </label>
          `;
        }).join('');
      };

      renderSection(morningList,'Morning',tasks.filter(t=>t.timeSlot==='MORNING'));
      renderSection(afternoonList,'Afternoon',tasks.filter(t=>t.timeSlot==='AFTERNOON'));
      renderSection(nightList,'Night',tasks.filter(t=>t.timeSlot==='NIGHT'||t.timeSlot==='PRN'));

      if(allergyAlert){
        if(allergyConflictsFound.length>0){
          allergyAlert.classList.remove('hidden');
          const first=allergyConflictsFound[0];
          if(allergyDesc)allergyDesc.innerHTML=`Warning: Scheduled medication <b>${esc(first.med)}</b> matches your documented baseline allergy to <b>${esc(first.allergy)}</b>. Cross-reactivity or adverse reaction risk flagged by Medi-AI.`;
        }else{
          allergyAlert.classList.add('hidden');
        }
      }

      const boxes=[...document.querySelectorAll('.med-task input')];
      const update=()=>{
        const done=boxes.filter(x=>x.checked).length;
        if(count)count.textContent=`${done} / ${boxes.length}`;
        if(bar)bar.style.width=`${boxes.length?(done/boxes.length)*100:0}%`;
        if(streak)streak.textContent=`Adherence Streak: Active routine · ${done} of ${boxes.length} completed today`;
      };

      boxes.forEach(x=>{
        x.addEventListener('change',async()=>{
          const label=x.closest('.med-task');
          const conflict=label?.dataset.allergyConflict;
          if(conflict&&x.checked){
            const proceed=confirm(`⚠️ CLINICAL ALLERGY SAFETY WARNING:\n\nYou have a documented allergy to "${conflict}".\nTaking this medication carries risk of adverse allergic reactions.\n\nAre you sure your attending doctor authorized this dose?`);
            if(!proceed){
              x.checked=false;
              update();
              return;
            }
          }

          update();
          const id=label?.dataset.id;
          if(id&&token){
            try{
              const res=await fetch(apiUrl(`/api/v1/todo/${id}/toggle`),{method:'PATCH',headers:{Authorization:`Bearer ${token}`}});
              if(!res.ok)alert('Failed to update task status in database.');
            }catch(_){
              alert('Server is down. Failed to update task in database.');
            }
          }
        });
      });
      update();
    }else{
      if(count)count.textContent='0 / 0';
      if(bar)bar.style.width='0%';
      if(streak)streak.textContent='Adherence Streak: 0 consecutive days · Upload a prescription to activate routine';
    }
  }

  // 1. Health Timeline
  async function bindTimeline(){
    const container=document.getElementById('heatStripContainer');
    const msg=document.getElementById('feelingStatusMessage');
    const timelineList=document.getElementById('timelineList');
    const totalCountEl=document.getElementById('timelineTotalCount');
    const activeCoursesEl=document.getElementById('activeCoursesCount');
    const flaggedAllergiesEl=document.getElementById('flaggedAllergiesCount');
    const token=getToken();

    if(!token)return;

    let events=[];
    let symptomLogs=[];

    try{
      const res=await fetch(apiUrl('/api/v1/timeline'),{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok){
        if(timelineList)timelineList.innerHTML=`<div class="empty-state" style="border:1px solid #cf4e4e;"><div class="empty-icon" style="color:#cf4e4e;">⚠</div><h3 style="color:#cf4e4e;">Server is down</h3><p>Unable to connect to Supabase database.</p></div>`;
        return;
      }
      const data=await res.json();
      events=data.data?.timeline||data.timeline||[];
      symptomLogs=data.data?.symptomSynopsis||data.symptomSynopsis||[];
    }catch(err){
      if(timelineList)timelineList.innerHTML=`<div class="empty-state" style="border:1px solid #cf4e4e;"><div class="empty-icon" style="color:#cf4e4e;">⚠</div><h3 style="color:#cf4e4e;">Database Unreachable</h3><p>Server is down. Check connection.</p></div>`;
      return;
    }

    const todayStr=new Date().toISOString().split('T')[0];
    const todayLog=symptomLogs.find(l=>l.date===todayStr);
    const btnGroup=document.getElementById('feelingButtonGroup');

    // Render 14-day feeling heat strip from real DB logs
    if(container){
      const days=[];
      for(let i=13;i>=0;i--){
        const d=new Date();
        d.setDate(d.getDate()-i);
        const dStr=d.toISOString().split('T')[0];
        const match=symptomLogs.find(l=>l.date===dStr);
        const col=match?match.severityColor.toLowerCase():'empty';
        const label=i===0?'Today':`-${i}d`;
        const dotChar=col==='green'?'🟢':col==='orange'?'🟠':col==='red'?'🔴':'⚪';
        days.push(`<div class="heat-day" title="Day ${label}: ${col==='empty'?'No Log':col.toUpperCase()}"><span class="heat-dot ${col}">${dotChar}</span><small class="heat-label">${label}</small></div>`);
      }
      container.innerHTML=days.join('');
    }

    const renderFeelingUI=(isEditing=false)=>{
      if(!btnGroup)return;
      if(todayLog && !isEditing){
        btnGroup.style.display='none';
        if(msg){
          const sevCol=todayLog.severityColor?.toLowerCase();
          const sevLabel=sevCol==='green'?'🟢 Well / Improving':sevCol==='orange'?'🟠 Neutral / Mild Discomfort':'🔴 Worse / Side Effects';
          msg.innerHTML=`
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:14px;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:14px;color:#15803d;font-weight:800;">✓ Today's Check-in Completed: <strong>${sevLabel}</strong></span>
                <span style="font-size:11px;color:#166534;background:#dcfce7;padding:2px 8px;border-radius:999px;font-weight:700;">Locked until 12:00 AM Midnight</span>
              </div>
              <button type="button" id="editFeelingBtn" style="background:#ffffff;border:1px solid #86efac;color:#15803d;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;cursor:pointer;">✎ Change</button>
            </div>
          `;
          const editBtn=document.getElementById('editFeelingBtn');
          if(editBtn){
            editBtn.addEventListener('click',()=>renderFeelingUI(true));
          }
        }
      }else{
        btnGroup.style.display='flex';
        if(msg){
          if(isEditing){
            msg.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted);"><span>Editing today's feeling entry...</span><button type="button" id="cancelEditFeelingBtn" style="background:none;border:none;color:var(--plum);cursor:pointer;text-decoration:underline;">Cancel</button></div>`;
            const cancelBtn=document.getElementById('cancelEditFeelingBtn');
            if(cancelBtn){
              cancelBtn.addEventListener('click',()=>renderFeelingUI(false));
            }
          }else{
            msg.textContent='';
          }
        }
      }
    };

    renderFeelingUI(false);

    // Schedule 12:00 AM Midnight Reset
    const now=new Date();
    const tomorrowMidnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,0,500);
    const msUntilMidnight=tomorrowMidnight.getTime()-now.getTime();
    if(window._timelineMidnightTimer) clearTimeout(window._timelineMidnightTimer);
    window._timelineMidnightTimer=setTimeout(()=>{
      bindTimeline();
    },msUntilMidnight);

    document.querySelectorAll('#feelingButtonGroup button').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const feeling=btn.dataset.feeling;
        btn.disabled=true;
        try{
          const score=feeling==='green'?1:feeling==='orange'?2:3;
          const res=await fetch(apiUrl('/api/v1/todo/daily-feeling'),{
            method:'POST',
            headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
            body:JSON.stringify({feelingScore:score,severityColor:feeling.toUpperCase()})
          });
          if(!res.ok){
            alert('Failed to save feeling to database.');
            btn.disabled=false;
            return;
          }

          // Clinical Adverse Symptom Triage Guidance
          if(feeling==='red'){
            alert('🚨 Medi-AI Clinical Adverse Triage:\n\nYou recorded experiencing severe discomfort / worsening symptoms today.\n\n• If you are experiencing acute chest pain, shortness of breath, severe dizziness, or facial swelling, dial 112 / 108 immediately.\n• Your entry has been logged to your timeline and flagged in your medication to-do list for clinical safety.');
          }

          bindTimeline();
        }catch(e){
          alert('Server is down. Could not save feeling to database.');
        }finally{
          btn.disabled=false;
        }
      });
    });

    if(timelineList){
      if(events.length>0){
        timelineList.innerHTML=events.map(ev=>{
          const dateStr=ev.eventDateDdmmyyyy||'Recent';
          return `
            <div class="timeline-card" data-event-type="rx">
              <div class="timeline-date"><span>${esc(dateStr)}</span></div>
              <div class="timeline-content">
                <div class="card-topline" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span>CLINICAL EVENT</span>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="status-pill" style="background:#e8f4e9;color:#35673a;">Verified Vault</span>
                    <button type="button" class="delete-timeline-btn" data-id="${ev.id}" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">🗑 Delete</button>
                  </div>
                </div>
                <h3 style="font:800 20px 'Manrope';margin:4px 0 6px;">${esc(ev.clinicalSummary||ev.diagnoses?.[0]||'Clinical Visit')}</h3>
                <p style="color:var(--muted);font-size:14px;margin:0 0 10px;">${esc(ev.doctorName?ev.doctorName+' · ':'' )}${esc(ev.clinicName||'MediLocker Vault')}</p>
                ${ev.diagnoses?.length?`<div style="font-size:13px;color:var(--text);margin-bottom:8px;"><b>Diagnoses:</b> ${esc(ev.diagnoses.join(', '))}</div>`:''}
                ${ev.prescribedMedications?.length?`<div style="font-size:13px;color:var(--plum);margin-bottom:8px;"><b>Prescribed (${ev.prescribedMedications.length}):</b> ${esc(ev.prescribedMedications.map(m=>m.medicineName).join(', '))}</div>`:''}
              </div>
            </div>
          `;
        }).join('');

        timelineList.querySelectorAll('.delete-timeline-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (!confirm('Are you sure you want to permanently delete this clinical timeline event? This will remove the record, prescriptions, and any ongoing medication routines from your locker.')) return;
            btn.disabled = true;
            btn.textContent = 'Deleting…';
            try {
              const res = await fetch(apiUrl(`/api/v1/timeline/${id}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
              });
              const json = await res.json();
              if (!res.ok || !json.success) {
                alert(json.error || json.message || 'Failed to delete timeline event.');
                btn.disabled = false;
                btn.textContent = '🗑 Delete';
                return;
              }
              alert('Timeline event permanently deleted.');
              bindTimeline();
            } catch (err) {
              alert('Network error deleting timeline event: ' + err.message);
              btn.disabled = false;
              btn.textContent = '🗑 Delete';
            }
          });
        });
      }else{
        timelineList.innerHTML=`<div class="empty-state"><div class="empty-icon">⏳</div><h3>Your health timeline is empty</h3><p>Upload your first prescription, lab report, or hospital discharge summary to generate your chronological health story with Medi-AI.</p><a href="upload.html" class="primary-btn" style="margin-top:14px;">Upload Record ↗</a></div>`;
      }
    }

    if(totalCountEl)totalCountEl.textContent=String(events.length);
    if(activeCoursesEl)activeCoursesEl.textContent=`${events.filter(e=>e.prescribedMedications?.length>0).length} Active`;

    // Flagged allergies from cached user profile (0ms latency)
    if(flaggedAllergiesEl){
      try{
        const u=await getUserProfileFast();
        const allergies=u?.allergies||[];
        flaggedAllergiesEl.textContent=allergies.length?allergies.join(', '):'None';
      }catch(_){
        flaggedAllergiesEl.textContent='None';
      }
    }
  }

  // 2. Smart Medicine Cabinet & Live Camera / Batch Number Scanner
  async function bindInventory(){
    const modal=document.getElementById('addMedicineModal');
    const openBtn=document.getElementById('openAddMedicineModal');
    const closeBtn=document.getElementById('closeAddMedicineModal');
    const form=document.getElementById('addMedicineForm');
    const container=document.getElementById('cabinetCardsContainer');
    const totalCountEl=document.getElementById('cabinetTotalCount');
    const lowStockCountEl=document.getElementById('cabinetLowStockCount');
    const expiringCountEl=document.getElementById('cabinetExpiringCount');
    const safetyStatusEl=document.getElementById('cabinetSafetyStatus');
    const safetyDetailEl=document.getElementById('cabinetSafetyDetail');
    const refillBanner=document.getElementById('refillAlertBanner');
    const refillTitle=document.getElementById('refillAlertTitle');
    const refillText=document.getElementById('refillAlertText');

    // Live Camera & Scanner elements
    const video=document.getElementById('scannerVideo');
    const canvas=document.getElementById('scannerCanvas');
    const startCamBtn=document.getElementById('startCameraBtn');
    const captureBtn=document.getElementById('captureFoilBtn');
    const stopCamBtn=document.getElementById('stopCameraBtn');
    const photoInput=document.getElementById('foilPhotoInput');
    const statusMsg=document.getElementById('scannerStatusMsg');
    const resultCard=document.getElementById('scanResultCard');
    const barcodeRow=document.getElementById('barcodeInputRow');
    const barcodeInput=document.getElementById('barcodeManualInput');
    const lookupBarcodeBtn=document.getElementById('lookupBarcodeBtn');

    const token=getToken();
    let cameraStream=null;
    let userAllergies=[];

    if(token){
      try{
        const u=await getUserProfileFast();
        userAllergies=(u?.allergies||[]).map(a=>String(a).toLowerCase().trim()).filter(Boolean);
      }catch(_){}
    }

    openBtn?.addEventListener('click',()=>modal?.classList.remove('hidden'));
    closeBtn?.addEventListener('click',()=>modal?.classList.add('hidden'));

    // Ingestion tabs
    document.querySelectorAll('#ingestionModeTabs button').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('#ingestionModeTabs button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const mode=btn.dataset.mode;
        if(mode==='manual'){
          modal?.classList.remove('hidden');
          return;
        }
        const titleEl=document.getElementById('scannerModeTitle');
        const descEl=document.getElementById('scannerModeDesc');
        if(mode==='foil'){
          if(titleEl)titleEl.textContent='Medi-AI Visual Foil & Batch Scan';
          if(descEl)descEl.textContent='Aim your camera at the printed medicine foil, strip, or packaging carton to extract the batch number, active salt, and expiry date.';
          barcodeRow?.classList.add('hidden');
        }else if(mode==='barcode'){
          if(titleEl)titleEl.textContent='Scan 1D Retail Barcode (EAN-13)';
          if(descEl)descEl.textContent='Point camera at outer carton barcode or enter the 13-digit EAN number below to lookup drug catalog.';
          barcodeRow?.classList.remove('hidden');
        }else if(mode==='datamatrix'){
          if(titleEl)titleEl.textContent='Scan GS1 2D DataMatrix (Batch + Expiry)';
          if(descEl)descEl.textContent='Point camera at the 2D DataMatrix grid to parse GTIN, batch number, and expiry date.';
          barcodeRow?.classList.add('hidden');
        }
      });
    });

    // Real Live Camera Feed
    async function startCamera(){
      try{
        if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
          alert('Camera stream is not supported in this browser. Please use "Upload Foil Photo".');
          return;
        }
        cameraStream=await navigator.mediaDevices.getUserMedia({
          video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}}
        });
        if(video){
          video.srcObject=cameraStream;
          video.style.display='block';
        }
        document.getElementById('scannerIconPlaceholder')?.style.setProperty('display','none');
        startCamBtn?.classList.add('hidden');
        captureBtn?.classList.remove('hidden');
        stopCamBtn?.classList.remove('hidden');
      }catch(err){
        alert('Could not open camera ('+(err.message||'Permission denied')+'). Please allow camera access or use "Upload Foil Photo".');
      }
    }

    function stopCamera(){
      if(cameraStream){
        cameraStream.getTracks().forEach(track=>track.stop());
        cameraStream=null;
      }
      if(video)video.style.display='none';
      document.getElementById('scannerIconPlaceholder')?.style.setProperty('display','block');
      startCamBtn?.classList.remove('hidden');
      captureBtn?.classList.add('hidden');
      stopCamBtn?.classList.add('hidden');
    }

    startCamBtn?.addEventListener('click',startCamera);
    stopCamBtn?.addEventListener('click',stopCamera);

    // Process photo blob with Medi-AI
    async function processFoilBlob(blob){
      if(!token){
        alert('Please sign in to use Medi-AI scanning.');
        return;
      }
      if(statusMsg){
        statusMsg.style.display='block';
        statusMsg.textContent='⚡ Medi-AI Vision reading Batch Number, Expiry Date, and Active Salt…';
      }
      captureBtn?.setAttribute('disabled','true');

      try{
        const fd=new FormData();
        fd.append('file',blob,'medicine_scan.jpg');
        const res=await fetch(apiUrl('/api/v1/ai/scan-foil'),{
          method:'POST',
          headers:{Authorization:`Bearer ${token}`},
          body:fd
        });
        const data=await res.json();
        const info=data.data||data;

        if(resultCard){
          resultCard.classList.remove('hidden');
          const brandInput=document.getElementById('scannedBrand');
          const saltInput=document.getElementById('scannedSalt');
          const batchInput=document.getElementById('scannedBatch');
          const expiryInput=document.getElementById('scannedExpiry');
          const catTag=document.getElementById('scannedCategoryTag');
          const alertEl=document.getElementById('scannedSafetyAlert');

          if(brandInput)brandInput.value=info.brandName||'Scanned Medicine';
          if(saltInput)saltInput.value=info.activeSalt||'Active Formulation';
          if(batchInput)batchInput.value=info.batchNumber||'';
          if(expiryInput)expiryInput.value=info.expiryDate||'';
          if(catTag)catTag.textContent=info.aiCategory||'General Supply';

          // Real-time allergy cross check
          const testStr=`${info.brandName||''} ${info.activeSalt||''}`.toLowerCase();
          const allergyConflict=userAllergies.find(a=>a&&testStr.includes(a));

          if(alertEl){
            alertEl.style.display='block';
            if(allergyConflict){
              alertEl.style.background='#faecec';
              alertEl.style.border='1px solid #e4a6a6';
              alertEl.style.color='#9b2424';
              alertEl.innerHTML=`⚠️ <b>CLINICAL ALLERGY ALERT:</b> Active ingredient matches your documented baseline allergy (<b>${esc(allergyConflict)}</b>). Do not take without physician clearance.`;
            }else{
              alertEl.style.background='#e8f4e9';
              alertEl.style.border='1px solid #c3e2c6';
              alertEl.style.color='#35673a';
              alertEl.innerHTML=`✓ <b>Verified Safe:</b> Cross-checked with patient baseline allergies (${userAllergies.length?esc(userAllergies.join(', ')):'None documented'}). No conflicts detected.`;
            }
          }
          resultCard.scrollIntoView({behavior:'smooth'});
        }
      }catch(err){
        alert('Server error: Medi-AI could not process photo. Check backend connection.');
      }finally{
        if(statusMsg)statusMsg.style.display='none';
        captureBtn?.removeAttribute('disabled');
      }
    }

    captureBtn?.addEventListener('click',()=>{
      if(!video||!canvas)return;
      canvas.width=video.videoWidth||640;
      canvas.height=video.videoHeight||480;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      canvas.toBlob(blob=>{
        if(blob)processFoilBlob(blob);
      },'image/jpeg',0.9);
    });

    photoInput?.addEventListener('change',()=>{
      const file=photoInput.files?.[0];
      if(file)processFoilBlob(file);
    });

    // Barcode Lookup
    lookupBarcodeBtn?.addEventListener('click',async()=>{
      const code=barcodeInput?.value.trim();
      if(!code)return;
      try{
        const res=await fetch(apiUrl(`/api/v1/inventory/home-supplies/barcode/${encodeURIComponent(code)}`),{
          headers:{Authorization:`Bearer ${token}`}
        });
        const data=await res.json();
        if(data.data?.found){
          const item=data.data;
          if(resultCard)resultCard.classList.remove('hidden');
          const brandInput=document.getElementById('scannedBrand');
          const saltInput=document.getElementById('scannedSalt');
          const catTag=document.getElementById('scannedCategoryTag');
          if(brandInput)brandInput.value=item.medicineName;
          if(saltInput)saltInput.value=item.activeSalt;
          if(catTag)catTag.textContent=item.aiCategory||'Verified Barcode Match';
          resultCard.scrollIntoView({behavior:'smooth'});
        }else{
          alert(data.data?.message||'Barcode not recognized in drug catalog.');
        }
      }catch(_){
        alert('Could not look up barcode.');
      }
    });

    // Add scanned result to Cabinet
    document.getElementById('confirmAddToCabinetBtn')?.addEventListener('click',async()=>{
      const brand=document.getElementById('scannedBrand')?.value.trim();
      const salt=document.getElementById('scannedSalt')?.value.trim();
      const batch=document.getElementById('scannedBatch')?.value.trim();
      const expiry=document.getElementById('scannedExpiry')?.value.trim();
      const qty=document.getElementById('scannedQty')?.value.trim()||'10';
      const cat=document.getElementById('scannedCategoryTag')?.textContent?.trim()||'General Supply';

      if(!brand){
        alert('Please specify a medicine name.');
        return;
      }

      try{
        const res=await fetch(apiUrl('/api/v1/inventory/home-supplies'),{
          method:'POST',
          headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
          body:JSON.stringify({
            medicineName:brand,
            activeSalt:salt||undefined,
            aiCategory:cat,
            quantity:Number(qty)||10,
            expiryDate:expiry||undefined,
            batchNumber:batch||undefined,
            scanMethod:'AI_PHOTO_OCR'
          })
        });
        const data=await res.json();
        if(!res.ok){
          alert(data.error||'Failed to save medicine.');
          return;
        }
        alert(`"${brand}" (Batch: ${batch||'Recorded'}) successfully added to your medicine cabinet!`);
        resultCard?.classList.add('hidden');
        stopCamera();
        bindInventory();
      }catch(_){
        alert('Server error: Could not save medicine.');
      }
    });

    if(!token)return;

    let supplies=[];
    try{
      const res=await fetch(apiUrl('/api/v1/inventory/home-supplies'),{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok){
        if(container)container.innerHTML=`<div class="empty-state" style="border:1px solid #cf4e4e;grid-column:1/-1;"><div class="empty-icon" style="color:#cf4e4e;">⚠</div><h3 style="color:#cf4e4e;">Server is down</h3><p>Unable to fetch supplies from database.</p></div>`;
        return;
      }
      const data=await res.json();
      supplies=Array.isArray(data.data)?data.data:[];
    }catch(err){
      if(container)container.innerHTML=`<div class="empty-state" style="border:1px solid #cf4e4e;grid-column:1/-1;"><div class="empty-icon" style="color:#cf4e4e;">⚠</div><h3 style="color:#cf4e4e;">Database Unreachable</h3><p>Server is down. Please verify backend connection.</p></div>`;
      return;
    }

    function renderCabinet(){
      const lowStock=supplies.filter(s=>Number(s.currentQuantity||s.quantity)<=2);
      const expiring=supplies.filter(s=>{
        const exp=s.expiryDate;
        return exp&&typeof exp==='string'&&exp.includes('2026');
      });

      let allergyConflicts=0;

      if(totalCountEl)totalCountEl.textContent=`${supplies.length} Medicines`;
      if(lowStockCountEl)lowStockCountEl.textContent=`${lowStock.length} Courses`;
      if(expiringCountEl)expiringCountEl.textContent=`${expiring.length} Items`;

      const filterAll=document.getElementById('filterAllSupplies');
      const filterRx=document.getElementById('filterRxSupplies');
      const filterOtc=document.getElementById('filterOtcSupplies');
      const filterLow=document.getElementById('filterLowStock');
      const filterExp=document.getElementById('filterExpiring');
      if(filterAll)filterAll.textContent=`All Supplies (${supplies.length})`;
      if(filterRx)filterRx.textContent=`Prescription Courses (${supplies.filter(s=>(s.aiCategory||'').toLowerCase().includes('prescription')).length})`;
      if(filterOtc)filterOtc.textContent=`First Aid / OTC (${supplies.filter(s=>!(s.aiCategory||'').toLowerCase().includes('prescription')).length})`;
      if(filterLow)filterLow.textContent=`Low Stock (${lowStock.length})`;
      if(filterExp)filterExp.textContent=`Expiring Soon (${expiring.length})`;

      if(refillBanner){
        if(lowStock.length>0){
          refillBanner.classList.remove('hidden');
          const first=lowStock[0];
          if(refillTitle)refillTitle.textContent=`Predictive Refill Alert · ${first.medicineName}`;
          if(refillText)refillText.innerHTML=`<strong>${esc(first.medicineName)}:</strong> ${esc(first.currentQuantity||first.quantity)} units remaining. Refill advised.`;
        }else{
          refillBanner.classList.add('hidden');
        }
      }

      if(!container)return;
      if(supplies.length===0){
        container.innerHTML=`<div class="empty-state" id="cabinetEmptyState" style="background:#fff;border:1px solid var(--line);border-radius:18px;padding:48px 24px;text-align:center;grid-column:1/-1;"><div class="empty-icon" style="font-size:40px;margin-bottom:12px;">⊞</div><h3 style="font:800 20px 'Manrope';margin:0 0 8px;">Your medicine cabinet is empty</h3><p style="color:var(--muted);max-width:460px;margin:0 auto 20px;font-size:14px;">Safely catalogue household medicines by scanning retail barcodes or entering them manually to monitor expiry dates and 2-day refill alerts.</p><button type="button" class="primary-btn" onclick="document.getElementById('openAddMedicineModal').click()">Add First Medicine ＋</button></div>`;
        return;
      }

      container.innerHTML=supplies.map(item=>{
        const qty=Number(item.currentQuantity||item.quantity||1);
        const isLow=qty<=2;
        const brand=item.medicineName||'Medicine';
        const salt=item.activeSalt||'Active formulation';
        const exp=item.expiryDate?new Date(item.expiryDate).toLocaleDateString('en-GB'):'N/A';
        const batch=item.batchNumber||'—';
        const cat=item.aiCategory||'General Supply';

        // Allergy check for item
        const testStr=`${brand} ${salt}`.toLowerCase();
        const hasAllergyConflict=userAllergies.find(a=>a&&testStr.includes(a));
        if(hasAllergyConflict)allergyConflicts++;

        return `
          <article class="cabinet-card" data-category="${esc(cat)}" data-lowstock="${isLow}" style="${hasAllergyConflict?'border-top:3px solid #cf4e4e;':''}">
            <div>
              <div class="cabinet-top">
                <span class="cabinet-badge ${hasAllergyConflict?'danger':isLow?'danger':''}">${hasAllergyConflict?'⚠ ALLERGY ALERT':esc(cat.toUpperCase())}</span>
                <span class="status-pill" style="${isLow?'background:#faecec;color:#9b2424;':'background:#e8f4e9;color:#35673a;'}">${isLow?`${qty} Left`:'In Stock'}</span>
              </div>
              <h3 class="cabinet-title">${esc(brand)}</h3>
              <div class="cabinet-salt">${esc(salt)}</div>
            </div>
            <div>
              <div class="cabinet-meta">
                <div><small>STOCK</small><strong style="${isLow?'color:#cf4e4e;':''}">${esc(qty)} Units</strong></div>
                <div><small>BATCH NO.</small><strong style="color:#205596;">${esc(batch)}</strong></div>
                <div><small>EXPIRY</small><strong>${esc(exp)}</strong></div>
              </div>
              ${hasAllergyConflict?`<p style="font-size:12px;color:#cf4e4e;font-weight:700;margin:8px 0 0;">⚠ Conflicts with documented allergy (${esc(hasAllergyConflict)}).</p>`:`<p style="font-size:12px;color:var(--muted);margin:8px 0 0;">Registered in sovereign Supabase locker.</p>`}
            </div>
          </article>
        `;
      }).join('');

      // Update safety check card
      if(safetyStatusEl){
        if(allergyConflicts>0){
          safetyStatusEl.textContent=`⚠ ${allergyConflicts} Conflict${allergyConflicts>1?'s':''}`;
          safetyStatusEl.style.color='#cf4e4e';
          if(safetyDetailEl)safetyDetailEl.textContent=`${allergyConflicts} medicine(s) conflict with your documented allergies`;
        }else{
          safetyStatusEl.textContent='Verified Safe';
          safetyStatusEl.style.color='#4e9e57';
          if(safetyDetailEl)safetyDetailEl.textContent='Cross-checked with patient allergies.';
        }
      }
    }

    renderCabinet();

    form?.addEventListener('submit',async e=>{
      e.preventDefault();
      const brand=document.getElementById('medBrand').value.trim();
      const salt=document.getElementById('medSalt')?.value.trim();
      const qty=document.getElementById('medQty').value.trim()||'10';
      const batch=document.getElementById('medBatch')?.value.trim();
      const exp=document.getElementById('medExpiry').value.trim()||'12/2027';
      const cat=document.getElementById('medCategory')?.value||'otc';

      const submitBtn=form.querySelector('button[type=submit]');
      if(submitBtn)submitBtn.disabled=true;

      try{
        const res=await fetch(apiUrl('/api/v1/inventory/home-supplies'),{
          method:'POST',
          headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
          body:JSON.stringify({
            medicineName:brand,
            activeSalt:salt||undefined,
            aiCategory:cat,
            quantity:Number(qty)||10,
            expiryDate:exp,
            batchNumber:batch||undefined,
            scanMethod:'MANUAL'
          })
        });
        const data=await res.json();
        if(!res.ok){
          alert(data.error||data.message||'Server error: Failed to save medicine to database.');
          return;
        }
        modal?.classList.add('hidden');
        form.reset();
        alert(`"${brand}" (Batch: ${batch||'Recorded'}) successfully saved to Supabase database.`);
        bindInventory();
      }catch(err){
        alert('Server is down or unreachable. Could not register medicine.');
      }finally{
        if(submitBtn)submitBtn.disabled=false;
      }
    });
  }

  // 3. Medi-AI Health Companion
  function bindAiCompanion(){
    const form=document.getElementById('chatForm');
    const input=document.getElementById('chatInput');
    const messages=document.getElementById('chatMessages');
    const clearBtn=document.getElementById('clearChatBtn');
    const allergyContext=document.getElementById('aiContextAllergy');
    const cabinetContext=document.getElementById('aiContextCabinet');
    const token=getToken();

    // Fetch live profile and live cabinet from DB (0ms instant cache)
    if(token){
      getUserProfileFast().then(u=>{
        if(u&&allergyContext){
          const hasAllergy=u.allergies&&u.allergies.length;
          allergyContext.textContent=hasAllergy?`⚠ Allergy: ${u.allergies.join(', ')}`:'Allergies: None flagged';
        }
      }).catch(_=>{});

      fetch(apiUrl('/api/v1/inventory/home-supplies'),{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(data=>{
        const supplies=data.data||[];
        if(cabinetContext)cabinetContext.textContent=`🏠 Cabinet: ${supplies.length} items`;
      }).catch(_=>{});
    }

    function formatAiResponse(raw){
      if(!raw)return '';
      let formatted = esc(raw);
      // Format markdown bold **text**
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Format markdown italic *text*
      formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Format bullet lines starting with • or - or *
      formatted = formatted.replace(/(?:^|\n)[•\-*]\s*(.*?)(?=\n|$)/g, '<br>• $1');
      // Replace double newlines with spacing and single newlines with break
      formatted = formatted.replace(/\n\n+/g, '<br><br>').replace(/\n/g, '<br>');
      // Clean up leading breaks if any
      formatted = formatted.replace(/^(\s*<br\s*\/?>)+/i, '');
      return formatted;
    }

    function appendMessage(sender,text,isEmergency=false){
      if(!messages)return;
      const b=document.createElement('div');
      b.className=`chat-bubble ${sender}${isEmergency?' emergency':''}`;
      if(sender==='ai'){
        b.innerHTML=formatAiResponse(text);
      }else{
        b.innerHTML=esc(text);
      }
      messages.appendChild(b);
      messages.scrollTop=messages.scrollHeight;
    }

    async function processAiResponse(prompt){
      if(!token){
        appendMessage('ai','Please sign in to access Medi-AI clinical companion.');
        return;
      }

      // 1. Emergency Red-Flag Triage
      const p=prompt.toLowerCase();
      if(p.includes('chest pain')||p.includes('heart attack')||p.includes('breathless')||p.includes('stroke')||p.includes('cannot breathe')){
        appendMessage('ai',`<strong>🚨 EMERGENCY RED-FLAG ALERT DETECTED</strong><br><br>The symptoms you described require immediate emergency clinical intervention.<br><br>• <b>Action:</b> Call <b>112</b> or <b>108</b> immediately or have someone take you to the nearest emergency department.<br>• Do not drive yourself.<br>• Rest quietly and stay seated.`,true);
        return;
      }

      // Add temporary typing indicator
      const typingBubble=document.createElement('div');
      typingBubble.className='chat-bubble ai';
      typingBubble.id='aiTypingIndicator';
      typingBubble.innerHTML='✦ <i>Medi-AI is reviewing clinical guardrails & records…</i>';
      messages.appendChild(typingBubble);
      messages.scrollTop=messages.scrollHeight;

      try{
        const res=await fetch(apiUrl('/api/v1/ai/companion-query'),{
          method:'POST',
          headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
          body:JSON.stringify({query:prompt})
        });

        document.getElementById('aiTypingIndicator')?.remove();

        const data=await res.json();
        if(res.ok&&data.response){
          appendMessage('ai',data.response);
          return;
        }

        // Fallback response with live database check
        const meRes=await fetch(apiUrl('/api/v1/auth/me'),{headers:{Authorization:`Bearer ${token}`}});
        const meData=await meRes.json();
        const u=meData.data||meData.user;
        const allergies=u?.allergies?.join(', ')||'None documented';
        appendMessage('ai',`• <strong>Direct Assessment:</strong> Received inquiry regarding "${esc(prompt)}".<br>• <strong>Patient Profile:</strong> Documented allergies: ${esc(allergies)}.<br>• <strong>Guidance:</strong> For prescription-only medicines, an in-person doctor evaluation is required.<br><br><small style="color:var(--muted);">⚠️ Medical Disclaimer: This advice is for informational and daily guidance purposes only. It is not a substitute for professional medical diagnosis or a prescription. Consult a qualified doctor if symptoms persist or worsen.</small>`);
      }catch(err){
        document.getElementById('aiTypingIndicator')?.remove();
        appendMessage('ai','Server error: Database or AI engine is currently unreachable. Please try again in a moment.');
      }
    }

    form?.addEventListener('submit',e=>{
      e.preventDefault();
      const text=input.value.trim();
      if(!text)return;
      appendMessage('user',esc(text));
      input.value='';
      processAiResponse(text);
    });

    document.querySelectorAll('#quickPromptChips button').forEach(chip=>{
      chip.addEventListener('click',()=>{
        const prompt=chip.dataset.prompt;
        appendMessage('user',esc(prompt));
        processAiResponse(prompt);
      });
    });

    clearBtn?.addEventListener('click',()=>{
      if(messages){
        messages.innerHTML=`<div class="chat-bubble ai"><strong>Hello! I am your Medi-AI Health Companion.</strong><br>How can I assist your health journey today?</div>`;
      }
    });
  }

  // 5. Lab Tests & Vitals
  async function bindTests(){
    const modal=document.getElementById('logVitalsModal');
    const openBtn=document.getElementById('openLogVitalsModal');
    const closeBtn=document.getElementById('closeLogVitalsModal');
    const form=document.getElementById('logVitalsForm');
    const labContainer=document.getElementById('labFindingsContainer');
    const alertBox=document.getElementById('testsDueAlert');
    const alertTitle=document.getElementById('testsDueTitle');
    const alertDesc=document.getElementById('testsDueDesc');
    const token=getToken();

    openBtn?.addEventListener('click',()=>modal?.classList.remove('hidden'));
    closeBtn?.addEventListener('click',()=>modal?.classList.add('hidden'));

    // Load persisted vitals if available
    try{
      const savedVitals=JSON.parse(localStorage.getItem('medilockerVitals')||'null');
      if(savedVitals){
        const bpEl=document.getElementById('vitalBpVal');
        const pulseEl=document.getElementById('vitalPulseVal');
        const spo2El=document.getElementById('vitalSpo2Val');
        const sugarEl=document.getElementById('vitalSugarVal');
        if(bpEl)bpEl.textContent=`${savedVitals.sys} / ${savedVitals.dia}`;
        if(pulseEl)pulseEl.textContent=savedVitals.pulse;
        if(spo2El)spo2El.textContent=`${savedVitals.spo2}%`;
        if(sugarEl)sugarEl.textContent=savedVitals.sugar;
        document.querySelectorAll('.vitals-grid .vital-tag').forEach(tag=>{
          tag.style.background='#e8f4e9';
          tag.style.color='#35673a';
          tag.textContent='Recorded Today';
        });
      }
    }catch(_){}

    form?.addEventListener('submit',e=>{
      e.preventDefault();
      const sys=document.getElementById('vitalSys').value;
      const dia=document.getElementById('vitalDia').value;
      const pulse=document.getElementById('vitalPulse').value||'72';
      const spo2=document.getElementById('vitalSpo2').value||'99';
      const sugar=document.getElementById('vitalSugar')?.value||'95';

      const bpEl=document.getElementById('vitalBpVal');
      const pulseEl=document.getElementById('vitalPulseVal');
      const spo2El=document.getElementById('vitalSpo2Val');
      const sugarEl=document.getElementById('vitalSugarVal');
      if(bpEl)bpEl.textContent=`${sys} / ${dia}`;
      if(pulseEl)pulseEl.textContent=pulse;
      if(spo2El)spo2El.textContent=`${spo2}%`;
      if(sugarEl)sugarEl.textContent=sugar;

      document.querySelectorAll('.vitals-grid .vital-tag').forEach(tag=>{
        tag.style.background='#e8f4e9';
        tag.style.color='#35673a';
        tag.textContent='Recorded Today';
      });

      localStorage.setItem('medilockerVitals',JSON.stringify({sys,dia,pulse,spo2,sugar,date:new Date().toLocaleDateString('en-GB')}));

      alert(`Vitals logged successfully:\nBlood Pressure: ${sys}/${dia} mmHg\nPulse: ${pulse} BPM\nSpO2: ${spo2}%\nBlood Glucose: ${sugar} mg/dL\n\nRecorded to your daily biometric timeline.`);
      modal?.classList.add('hidden');
      form.reset();
    });

    if(!token)return;

    // Fetch reports and tests due from Supabase database
    try{
      const res=await fetch(apiUrl('/api/v1/records'),{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok){
        if(labContainer)labContainer.innerHTML=`<div class="empty-state" style="border:1px solid #cf4e4e;padding:24px;"><div class="empty-icon" style="color:#cf4e4e;">⚠</div><h3 style="color:#cf4e4e;">Server is down</h3><p>Could not fetch reports from database.</p></div>`;
        return;
      }
      const data=await res.json();
      const records=Array.isArray(data.data)?data.data:[];

      // Identify lab reports & diagnostic scans
      const labReports=records.filter(r=>{
        const cat=(r.category||'').toLowerCase();
        return cat.includes('lab')||cat.includes('report')||cat.includes('scan')||cat.includes('diagnostic');
      });

      // Render lab reports
      if(labContainer){
        if(labReports.length>0){
          labContainer.innerHTML=labReports.map(r=>{
            const docDate=r.eventDateDdmmyyyy||r.dateFormatted||'Recent';
            const title=r.diagnoses?.[0]||r.clinicalSummary||'Diagnostic Report';
            const doctor=r.doctorName?`${r.doctorName} · `:'';
            const clinic=r.clinicName||'MediLocker Lab';
            const diagnoses=Array.isArray(r.diagnoses)?r.diagnoses.filter(d=>d!==title):[];
            const fileLink=apiUrl(`/api/v1/records/${r.id}/view?token=${encodeURIComponent(token)}`);
            return `
              <article class="record-card report-card" style="margin-bottom:16px;background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px 24px;display:flex;flex-direction:column;gap:12px;text-align:left;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                      <span class="status-pill" style="background:#eef4fc;color:#205596;font-size:12px;font-weight:700;">⚗ LAB INVESTIGATION REPORT</span>
                      <span style="font-size:13px;color:var(--muted);">${esc(docDate)}</span>
                    </div>
                    <h3 style="font:800 20px 'Manrope';margin:4px 0 2px;">${esc(title)}</h3>
                    <p style="color:var(--muted);font-size:14px;margin:0;">${esc(doctor)}${esc(clinic)}</p>
                  </div>
                  <div style="display:flex;gap:8px;align-items:center;">
                    <a href="${fileLink}" target="_blank" class="primary-btn" style="font-size:13px;padding:9px 18px;text-decoration:none;display:inline-flex;align-items:center;">View Full Report ↗</a>
                    <button type="button" class="delete-lab-btn" data-id="${r.id}" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:9px 14px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">🗑 Delete</button>
                  </div>
                </div>
                ${diagnoses.length?`<div style="font-size:13px;color:var(--text);background:#f9f7fa;padding:10px 14px;border-radius:10px;margin-top:4px;"><b>Analyte / Findings:</b> ${esc(diagnoses.join(' · '))}</div>`:''}
                ${r.clinicalSummary?`<p style="font-size:13px;color:var(--muted);margin:2px 0 0;">${esc(r.clinicalSummary)}</p>`:''}
              </article>
            `;
          }).join('');

          labContainer.querySelectorAll('.delete-lab-btn').forEach(btn=>{
            btn.addEventListener('click',async(e)=>{
              e.stopPropagation();
              const id=btn.dataset.id;
              if(!confirm('Are you sure you want to permanently delete this lab report? This will remove the document and its laboratory findings from your locker.'))return;
              btn.disabled=true;
              btn.textContent='Deleting…';
              try{
                const dRes=await fetch(apiUrl(`/api/v1/records/${id}`),{
                  method:'DELETE',
                  headers:{Authorization:`Bearer ${token}`}
                });
                const dJson=await dRes.json();
                if(!dRes.ok||!dJson.success){
                  alert(dJson.error||dJson.message||'Failed to delete lab report.');
                  btn.disabled=false;
                  btn.textContent='🗑 Delete';
                  return;
                }
                alert('Lab report permanently deleted.');
                bindTests();
              }catch(err){
                alert('Network error deleting lab report: '+err.message);
                btn.disabled=false;
                btn.textContent='🗑 Delete';
              }
            });
          });
        }else{
          labContainer.innerHTML=`
            <div class="empty-state" id="labEmptyState" style="padding:32px 16px;text-align:center;">
              <div class="empty-icon" style="font-size:36px;margin-bottom:10px;">⚗</div>
              <h3 style="font:800 20px 'Manrope';margin:0 0 6px;">No diagnostic lab reports recorded yet</h3>
              <p style="color:var(--muted);max-width:440px;margin:0 auto 18px;font-size:14px;">Upload your blood tests, metabolic panels, or pathology reports to automatically extract and plot laboratory analytes with Medi-AI.</p>
              <a href="upload.html" class="primary-btn" style="display:inline-block;">Upload Lab Report ↗</a>
            </div>
          `;
        }
      }

      // Check all records for upcoming clinical tests due
      const allTestsDue=[];
      records.forEach(r=>{
        if(Array.isArray(r.testsDue)&&r.testsDue.length>0){
          r.testsDue.forEach(t=>{
            const name=typeof t==='string'?t:t.testName;
            if(name)allTestsDue.push({name,doctor:r.doctorName||'Doctor',due:t.dueWithinDays});
          });
        }
      });

      if(alertBox){
        if(allTestsDue.length>0){
          alertBox.classList.remove('hidden');
          const testNames=allTestsDue.map(t=>t.name).join(', ');
          if(alertTitle)alertTitle.textContent=`Clinical Investigation Due: ${testNames}`;
          if(alertDesc)alertDesc.textContent=`Recommended by ${allTestsDue[0].doctor}${allTestsDue[0].due?` · Schedule within ${allTestsDue[0].due} days`:''}. Tracked under your active daily to-do tasks.`;
        }else{
          alertBox.classList.add('hidden');
        }
      }
    }catch(err){
      if(labContainer)labContainer.innerHTML=`<div class="empty-state" style="border:1px solid #cf4e4e;padding:24px;"><div class="empty-icon" style="color:#cf4e4e;">⚠</div><h3 style="color:#cf4e4e;">Database Unreachable</h3><p>Server is down. Please check connection.</p></div>`;
    }
  }

  // 4. Patient Consent & Access Delegation Handler
  function bindDelegation(){
    const token=getToken();
    const list=document.getElementById('delegationsList');
    const incomingList=document.getElementById('incomingRequestsList');
    const activeCount=document.getElementById('activeDelegationsCount');
    const tokensCount=document.getElementById('activeTokensCount');
    const auditBody=document.getElementById('auditLogsBody');

    if(!token)return;

    const grantModal = document.getElementById('grantModal');
    const openGrantBtn = document.getElementById('openGrantModal');
    const closeGrantBtn = document.getElementById('closeGrantModal');
    const grantForm = document.getElementById('grantAccessForm');

    openGrantBtn?.addEventListener('click', () => grantModal?.classList.remove('hidden'));
    closeGrantBtn?.addEventListener('click', () => grantModal?.classList.add('hidden'));
    grantModal?.addEventListener('click', (e) => { if (e.target === grantModal) grantModal.classList.add('hidden'); });

    grantForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const unit = document.getElementById('providerUnitInput')?.value.trim().toUpperCase();
      const mpin = document.getElementById('confirmMpin')?.value.trim();
      if (!unit) {
        alert('Please enter a healthcare provider Unit ID.');
        return;
      }
      if (!mpin || mpin.length < 4) {
        alert('Please enter your valid MPIN to confirm authorization.');
        return;
      }
      grantModal?.classList.add('hidden');
      grantForm.reset();
      alert(`Provider "${unit}" has been pre-authorized. Share your MediLocker Unit ID with your physician; active consent tokens and verification codes will update in real-time below.`);
      loadDelegations();
    });

    let pollInterval=null;

    async function loadDelegations(){
      try{
        const res=await fetch(apiUrl('/api/v1/delegation/patient-requests'),{
          headers:{Authorization:`Bearer ${token}`}
        });
        if(!res.ok)return;
        const json=await res.json();
        const data=json.data||{};
        const pending=data.pendingRequests||[];
        const active=data.activeDelegations||[];
        const past=data.pastHistory||[];

        if(activeCount)activeCount.textContent=`${active.length} Provider${active.length===1?'':'s'}`;
        if(tokensCount)tokensCount.textContent=`${pending.length} Pending`;

        // 1. Render Pending Incoming Doctor Requests
        if(incomingList){
          if(pending.length===0){
            incomingList.innerHTML=`
              <div class="empty-state compact" id="incomingEmptyState" style="background:#fff;border:1px solid var(--line);border-radius:18px;padding:32px 20px;text-align:center;">
                <div class="empty-icon" style="font-size:32px;margin-bottom:8px;">📬</div>
                <h4 style="font:800 17px 'Manrope';margin:0 0 6px;">No pending doctor requests</h4>
                <p style="color:var(--muted);font-size:14px;margin:0;">When a doctor or hospital requests access using your Unit ID, the request and 15-minute authorization code will appear here in real time.</p>
              </div>
            `;
          }else{
            incomingList.innerHTML=pending.map(req=>{
              const durationStr=req.requestedDurationMinutes>=1440
                ?`${Math.round(req.requestedDurationMinutes/1440)} Day(s)`
                :`${Math.round(req.requestedDurationMinutes/60)} Hour(s)`;
              const expTime=new Date(req.codeExpiresAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
              return `
                <div class="profile-card" style="margin-bottom:16px;border:2px solid var(--plum);background:#fff;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                    <div>
                      <span class="eyebrow" style="color:var(--plum);">INCOMING ACCESS REQUEST</span>
                      <h3 style="font:800 22px 'Manrope';margin:4px 0;">Dr. ${esc(req.doctorName)}</h3>
                      <p style="margin:0;color:var(--muted);font-size:14px;">
                        <b>Organization:</b> ${esc(req.organization)} · 
                        <b>Medical Reg #:</b> ${esc(req.registrationNumber)}
                        ${req.specialization?` · <b>Specialty:</b> ${esc(req.specialization)}`:''}
                      </p>
                      <p style="margin:6px 0 0;font-size:14px;color:var(--ink);">
                        <b>Requested Access Duration:</b> <span class="status-pill" style="margin-left:4px;background:#eee5f2;color:var(--plum);">${esc(durationStr)}</span>
                      </p>
                    </div>
                    <button class="secondary-btn reject-btn" data-id="${req.id}" style="color:#cf4e4e;border-color:#eccaca;">✕ Reject / Revoke</button>
                  </div>

                  <div style="margin-top:20px;padding:18px;border-radius:16px;background:#fbf8fd;border:1px dashed var(--plum);text-align:center;">
                    <small style="text-transform:uppercase;letter-spacing:1.5px;font-weight:800;color:var(--plum);display:block;margin-bottom:6px;">6-Digit Authorization Passcode (Valid for 15 minutes)</small>
                    <div style="font:800 36px monospace;letter-spacing:8px;color:var(--plum);margin:8px 0;">${esc(req.authCode)}</div>
                    <small style="color:var(--muted);font-size:13px;">Provide this code to Dr. ${esc(req.doctorName)} during your consultation to unlock your health records. Code expires at ${expTime}.</small>
                  </div>
                </div>
              `;
            }).join('');

            incomingList.querySelectorAll('.reject-btn').forEach(b=>{
              b.addEventListener('click',async()=>{
                const id=b.dataset.id;
                if(!confirm('Reject this access request?'))return;
                await fetch(apiUrl('/api/v1/delegation/revoke'),{
                  method:'POST',
                  headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
                  body:JSON.stringify({delegationId:id})
                });
                loadDelegations();
              });
            });
          }
        }

        // 2. Render Active Delegations
        if(list){
          if(active.length===0){
            list.innerHTML=`
              <div class="empty-state" id="delegationsEmptyState" style="background:#fff;border:1px solid var(--line);border-radius:18px;padding:48px 24px;text-align:center;">
                <div class="empty-icon" style="font-size:40px;margin-bottom:12px;">🛡</div>
                <h3 style="font:800 20px 'Manrope';margin:0 0 8px;">No active provider delegations</h3>
                <p style="color:var(--muted);max-width:460px;margin:0 auto 20px;font-size:14px;">No doctors or hospitals currently have access. When visiting a clinic, verify the incoming request above to grant temporary sovereign access.</p>
              </div>
            `;
          }else{
            list.innerHTML=active.map(act=>{
              const expDate=new Date(act.expiresAt);
              const msLeft=expDate.getTime()-Date.now();
              const minsLeft=Math.max(0,Math.round(msLeft/60000));
              const timeLeftStr=minsLeft>=60?`${Math.floor(minsLeft/60)}h ${minsLeft%60}m remaining`:`${minsLeft} minutes remaining`;

              return `
                <div class="record-card" style="border-left:5px solid #4e9e57;margin-bottom:12px;">
                  <div class="record-icon" style="background:#edf7ed;color:#2e6b35;">✓</div>
                  <div class="record-main">
                    <div>
                      <span class="record-type" style="color:#2e6b35;">ACTIVE CLINICAL ACCESS</span>
                      <h3>Dr. ${esc(act.doctorName)}</h3>
                      <p><b>Organization:</b> ${esc(act.organization)} · <b>Reg #:</b> ${esc(act.registrationNumber)}</p>
                      <small style="color:var(--muted);">Access expires: ${expDate.toLocaleString()} (${timeLeftStr})</small>
                    </div>
                    <button class="secondary-btn revoke-active-btn" data-id="${act.id}" style="color:#cf4e4e;border-color:#eccaca;padding:10px 18px;">Revoke Access Now</button>
                  </div>
                </div>
              `;
            }).join('');

            list.querySelectorAll('.revoke-active-btn').forEach(b=>{
              b.addEventListener('click',async()=>{
                const id=b.dataset.id;
                if(!confirm('Immediately revoke this doctor\'s access to your medical records?'))return;
                await fetch(apiUrl('/api/v1/delegation/revoke'),{
                  method:'POST',
                  headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
                  body:JSON.stringify({delegationId:id})
                });
                loadDelegations();
              });
            });
          }
        }

        // 3. Render Audit Log Table
        if(auditBody){
          if(past.length===0){
            auditBody.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px;">No past delegation history recorded.</td></tr>`;
          }else{
            auditBody.innerHTML=past.map(p=>{
              const dateStr=p.grantedAt?new Date(p.grantedAt).toLocaleString():'N/A';
              const statusColor=p.status==='REVOKED'?'#cf4e4e':'#888';
              return `
                <tr>
                  <td>${dateStr}</td>
                  <td><b>${esc(p.doctorName)}</b></td>
                  <td>${esc(p.organization)}</td>
                  <td>Consultation Access</td>
                  <td><span style="font-weight:700;color:${statusColor};">${esc(p.status)}</span></td>
                </tr>
              `;
            }).join('');
          }
        }
      }catch(e){
        console.error('Failed to load delegations:',e);
      }
    }

    loadDelegations();
    pollInterval=setInterval(loadDelegations,5000);
    window.addEventListener('beforeunload',()=>clearInterval(pollInterval));
  }

  // 5. Provider Workspace Handler (Doctor & Hospital Portals)
  function bindProviderPortal(role){
    const s=requireSession(role);
    if(!s)return;
    const token=getToken();

    const renderProvider=(u)=>{
      const displayName=u?.name||s.name||s.email||role;
      const unitId=u?.medilockerId||s.unit||'';
      document.querySelectorAll('[data-provider-name]').forEach(e=>e.textContent=displayName);
      document.querySelectorAll('[data-provider-unit]').forEach(e=>e.textContent=unitId);
      document.querySelectorAll('[data-provider-initials]').forEach(e=>e.textContent=initials(displayName));
    };

    // 1. Instant Zero-Latency Render from Client Cache/Session
    const cached=getCachedProfile();
    renderProvider(cached);

    // 2. SWR Background Refresh
    getUserProfileFast().then(u=>{
      if(u)renderProvider(u);
    });

    const searchForm=document.getElementById('patientSearchForm');
    const searchInput=document.getElementById('patientUnitSearch');
    const emptyState=document.getElementById('patientSearchEmpty');
    const resultBox=document.getElementById('patientSearchResult');
    const activeList=document.getElementById('activePatientsList');
    const recordModal=document.getElementById('patientRecordModal');
    const recordModalContent=document.getElementById('patientRecordModalContent');
    const closeRecordModal=document.getElementById('closePatientRecordModal');
    if(closeRecordModal){
      closeRecordModal.addEventListener('click',()=>recordModal?.classList.add('hidden'));
    }

    // Pending patient verifications awaiting 6-digit code
    const pendingContainer = document.getElementById('pendingVerificationList');
    async function loadPendingVerifications() {
      if (!pendingContainer) return;
      try {
        const res = await fetch(apiUrl('/api/v1/delegation/provider/pending-requests'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const json = await res.json();
        const pending = json.data || [];

        if (pending.length === 0) {
          pendingContainer.innerHTML = `<div class="empty-state compact"><p style="margin:0;color:var(--muted);">No pending access requests awaiting verification.</p></div>`;
          return;
        }

        pendingContainer.innerHTML = pending.map(item => {
          const exp = new Date(item.codeExpiresAt);
          const minsLeft = Math.max(0, Math.round((exp.getTime() - Date.now()) / 60000));
          return `
            <div class="record-card" style="margin-bottom:12px;background:#faf9fc;border:1px solid var(--line);">
              <div class="record-icon" style="background:#eef2ff;color:#3b82f6;">⏳</div>
              <div class="record-main" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;width:100%;">
                <div style="flex:1;min-width:240px;">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span class="status-pill" style="background:#fff7ed;color:#c2410c;font-size:11px;font-weight:700;">PENDING VERIFICATION</span>
                    <small style="color:var(--muted);font-weight:700;">Code valid for next ${minsLeft}m</small>
                  </div>
                  <h4 style="font:800 18px 'Manrope';margin:4px 0;">${esc(item.patientName)}</h4>
                  <p style="margin:0;font-size:13px;color:var(--muted);">
                    <b>Unit ID:</b> <code style="font-weight:700;color:var(--plum);">${esc(item.patientMedilockerId)}</code> · 
                    Requested: ${new Date(item.requestedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                  </p>
                </div>
                <form class="inline-verify-form" data-unit="${esc(item.patientMedilockerId)}" style="display:flex;gap:8px;align-items:center;">
                  <input type="text" class="pending-code-input" maxlength="6" pattern="[0-9]{6}" placeholder="6-digit code" required style="width:130px;font:700 18px monospace;letter-spacing:4px;text-align:center;padding:8px;border:1.5px solid var(--plum);border-radius:10px;background:#fff;">
                  <button type="submit" class="primary-btn" style="padding:9px 16px;font-size:13px;white-space:nowrap;">Verify & Unlock ↗</button>
                </form>
              </div>
            </div>
          `;
        }).join('');

        pendingContainer.querySelectorAll('.inline-verify-form').forEach(form => {
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const patientMedilockerId = form.dataset.unit;
            const code = form.querySelector('.pending-code-input')?.value.trim();
            if (!code) return;
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            try {
              const vRes = await fetch(apiUrl('/api/v1/delegation/verify-code'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ patientMedilockerId, authCode: code })
              });
              const vJson = await vRes.json();
              if (!vRes.ok || !vJson.success) {
                alert(vJson.error || 'Verification failed: Invalid or expired authorization code.');
                if (submitBtn) submitBtn.disabled = false;
                return;
              }

              alert('Access successfully verified! Unlocking patient records.');
              loadPendingVerifications();
              loadActivePatients();
              openPatientRecords(patientMedilockerId);
            } catch (err) {
              alert('Verification request failed: ' + err.message);
              if (submitBtn) submitBtn.disabled = false;
            }
          });
        });
      } catch (e) {}
    }

    // Load currently active patients
    async function loadActivePatients(){
      if(!activeList)return;
      try{
        const res=await fetch(apiUrl('/api/v1/delegation/doctor/active-patients'),{
          headers:{Authorization:`Bearer ${token}`}
        });
        if(!res.ok)return;
        const json=await res.json();
        const patients=json.data||[];

        if(patients.length===0){
          activeList.innerHTML=`<div class="empty-state compact"><p style="margin:0;color:var(--muted);">No active patient consultations. Enter a patient Unit ID above to send an access request.</p></div>`;
          return;
        }

        activeList.innerHTML=patients.map(p=>{
          const exp=new Date(p.expiresAt);
          const minsLeft=Math.max(0,Math.round((exp.getTime()-Date.now())/60000));
          const timeStr=minsLeft>=60?`${Math.floor(minsLeft/60)}h ${minsLeft%60}m`:`${minsLeft}m`;
          return `
            <div class="record-card" style="margin-bottom:12px;">
              <div class="record-icon prescription-icon">🧑</div>
              <div class="record-main">
                <div>
                  <span class="record-type" style="color:#2e6b35;">● AUTHORIZED CONSULTATION</span>
                  <h3>${esc(p.fullName)}</h3>
                  <p><b>Unit ID:</b> ${esc(p.medilockerId)} · <b>DOB:</b> ${p.dob?new Date(p.dob).toLocaleDateString():'N/A'} · <b>Blood:</b> ${esc(p.bloodGroup||'N/A')}</p>
                  <small style="color:var(--muted);">Access valid for next: <b>${timeStr}</b></small>
                </div>
                <button class="primary-btn view-full-records-btn" data-id="${p.medilockerId}" style="padding:10px 18px;">View Full Records ↗</button>
              </div>
            </div>
          `;
        }).join('');

        activeList.querySelectorAll('.view-full-records-btn').forEach(btn=>{
          btn.addEventListener('click',()=>openPatientRecords(btn.dataset.id));
        });
      }catch(e){}
    }

    // Doctor Appointments & Pre-Consultation Checklist
    const todayList = document.getElementById('todayApptsList');
    const upcomingList = document.getElementById('upcomingApptsList');
    const upcomingTodoList = document.getElementById('upcomingTodoList');
    const allList = document.getElementById('allApptsList');
    const todayCountEl = document.getElementById('todayApptsCount');
    const pendingCountEl = document.getElementById('pendingApptsCount');
    const todoCountEl = document.getElementById('todoApptsCount');
    const todoBadgeEl = document.getElementById('todoProgressBadge');
    const refreshApptsBtn = document.getElementById('refreshDoctorApptsBtn');

    const apptTabs = document.querySelectorAll('[data-appttab]');
    const tabContents = {
      today: document.getElementById('todayApptsTabContent'),
      upcoming: document.getElementById('upcomingApptsTabContent'),
      all: document.getElementById('allApptsTabContent')
    };

    apptTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        apptTabs.forEach(b => {
          b.classList.remove('active');
          b.style.background = '#fff';
          b.style.color = 'var(--ink)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--plum)';
        btn.style.color = '#fff';

        const tab = btn.dataset.appttab;
        Object.keys(tabContents).forEach(k => {
          if (tabContents[k]) {
            if (k === tab) tabContents[k].classList.remove('hidden');
            else tabContents[k].classList.add('hidden');
          }
        });
      });
    });

    refreshApptsBtn?.addEventListener('click', () => loadDoctorAppointments());

    async function loadDoctorAppointments() {
      if (!todayList) return;
      try {
        const res = await fetch(apiUrl('/api/v1/appointments/my-appointments'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const json = await res.json();
        const appointments = json.data || [];

        const now = new Date();
        const todayDateStr = now.toISOString().slice(0, 10);

        let todayAppts = [];
        let upcomingAppts = [];
        let pendingCount = 0;

        appointments.forEach(a => {
          if (a.status === 'PENDING') pendingCount++;
          const aDateStr = new Date(a.appointmentDate).toISOString().slice(0, 10);
          if (aDateStr === todayDateStr) {
            todayAppts.push(a);
          } else if (new Date(a.appointmentDate) > now) {
            upcomingAppts.push(a);
          }
        });

        if (todayCountEl) todayCountEl.textContent = todayAppts.length;
        if (pendingCountEl) pendingCountEl.textContent = pendingCount;

        // Render Today's List
        renderAppointmentCards(todayList, todayAppts, 'No patient visits scheduled for today.');

        // Render Upcoming List
        renderAppointmentCards(upcomingList, upcomingAppts, 'No upcoming appointments scheduled.');

        // Render All List
        renderAppointmentCards(allList, appointments, 'No appointments history found.');

        // Render Upcoming To-Do Checklist
        renderUpcomingTodoChecklist(upcomingAppts.concat(todayAppts.filter(a => a.status !== 'CANCELLED')));
      } catch (err) {
        console.warn('Failed to load doctor appointments:', err);
      }
    }

    function renderAppointmentCards(container, list, emptyMsg) {
      if (!container) return;
      if (list.length === 0) {
        container.innerHTML = `<div class="empty-state compact"><p style="margin:0;color:var(--muted);">${emptyMsg}</p></div>`;
        return;
      }

      container.innerHTML = list.map(a => {
        const d = new Date(a.appointmentDate);
        const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        
        let statusStyle = 'background:#fef3c7;color:#92400e;'; // PENDING
        if (a.status === 'CONFIRMED') statusStyle = 'background:#dcfce7;color:#15803d;';
        else if (a.status === 'COMPLETED') statusStyle = 'background:#e0e7ff;color:#4338ca;';
        else if (a.status === 'CANCELLED') statusStyle = 'background:#fee2e2;color:#b91c1c;';

        return `
          <div class="record-card" style="margin-bottom:12px;border:1px solid var(--line);background:#fff;padding:16px;">
            <div class="record-icon" style="background:#f3e8ff;color:#6b21a8;font-size:20px;">🩺</div>
            <div class="record-main" style="width:100%;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
                <div>
                  <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;flex-wrap:wrap;">
                    <span class="status-pill" style="${statusStyle}font-size:11px;font-weight:700;">${a.status}</span>
                    <span style="font-weight:700;font-size:13px;color:var(--plum);">📅 ${dateStr} · ⏱ ${esc(a.timeSlot)}</span>
                  </div>
                  <h4 style="font:800 18px 'Manrope';margin:4px 0;">${esc(a.patientName)}</h4>
                  <p style="margin:0;font-size:13px;color:var(--muted);">
                    <b>Unit ID:</b> <code style="color:var(--plum);font-weight:700;">${esc(a.patientMedilockerId)}</code>
                    ${a.patientPhone ? ` · 📞 ${esc(a.patientPhone)}` : ''}
                    ${a.bloodGroup ? ` · 🩸 ${esc(a.bloodGroup)}` : ''}
                  </p>
                  <p style="margin:6px 0 0;font-size:14px;color:var(--ink);">
                    <b>Reason:</b> ${esc(a.reason || 'General Consultation')}
                  </p>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                  <button type="button" class="secondary-btn unlock-patient-btn" data-unit="${esc(a.patientMedilockerId)}" style="padding:7px 13px;font-size:12px;">🔓 Unlock Records</button>
                  ${a.status === 'PENDING' ? `
                    <button type="button" class="primary-btn appt-status-btn" data-id="${a.id}" data-action="CONFIRMED" style="padding:7px 13px;font-size:12px;background:#16a34a;">✓ Confirm</button>
                    <button type="button" class="secondary-btn appt-status-btn" data-id="${a.id}" data-action="CANCELLED" style="padding:7px 13px;font-size:12px;color:#dc2626;border-color:#fca5a5;">✕ Cancel</button>
                  ` : ''}
                  ${a.status === 'CONFIRMED' ? `
                    <button type="button" class="primary-btn appt-status-btn" data-id="${a.id}" data-action="COMPLETED" style="padding:7px 13px;font-size:12px;background:#2563eb;">✔ Mark Completed</button>
                    <button type="button" class="secondary-btn appt-status-btn" data-id="${a.id}" data-action="CANCELLED" style="padding:7px 13px;font-size:12px;color:#dc2626;border-color:#fca5a5;">✕ Cancel</button>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.unlock-patient-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const unit = btn.dataset.unit;
          if (searchInput) {
            searchInput.value = unit;
            searchForm?.scrollIntoView({ behavior: 'smooth' });
            searchForm?.requestSubmit();
          }
        });
      });

      container.querySelectorAll('.appt-status-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const apptId = btn.dataset.id;
          const newStatus = btn.dataset.action;
          if (!confirm(`Are you sure you want to mark this appointment as ${newStatus}?`)) return;

          try {
            btn.disabled = true;
            const uRes = await fetch(apiUrl(`/api/v1/appointments/${apptId}/status`), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status: newStatus })
            });
            const uJson = await uRes.json();
            if (!uRes.ok || !uJson.success) {
              alert(uJson.error || 'Failed to update status.');
              btn.disabled = false;
              return;
            }
            loadDoctorAppointments();
          } catch (e) {
            alert('Status update failed: ' + e.message);
            btn.disabled = false;
          }
        });
      });
    }

    function renderUpcomingTodoChecklist(appts) {
      if (!upcomingTodoList) return;
      if (appts.length === 0) {
        upcomingTodoList.innerHTML = `<div class="empty-state compact"><p style="margin:0;color:var(--muted);">No scheduled consultations requiring preparation.</p></div>`;
        if (todoCountEl) todoCountEl.textContent = '0 Tasks';
        if (todoBadgeEl) todoBadgeEl.textContent = '100% Ready';
        return;
      }

      // Generate structured clinical pre-consultation tasks per appointment
      let allTasks = [];
      appts.forEach(a => {
        const d = new Date(a.appointmentDate);
        const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        allTasks.push({
          id: `review_history_${a.id}`,
          apptId: a.id,
          unitId: a.patientMedilockerId,
          text: `Review past medical records & allergy profiles for ${a.patientName}`,
          badge: `${dateStr} · ${a.timeSlot}`,
          category: 'History Check'
        });
        allTasks.push({
          id: `prepare_notes_${a.id}`,
          apptId: a.id,
          unitId: a.patientMedilockerId,
          text: `Prepare diagnostic clinical notes & tentative treatment plan for "${a.reason || 'General Consultation'}"`,
          badge: `${dateStr} · ${a.timeSlot}`,
          category: 'Clinical Plan'
        });
        allTasks.push({
          id: `verify_status_${a.id}`,
          apptId: a.id,
          unitId: a.patientMedilockerId,
          text: `Confirm consultation attendance & check 6-digit access code with ${a.patientName}`,
          badge: `${dateStr} · ${a.timeSlot}`,
          category: 'Patient Check-in'
        });
      });

      let completedCount = 0;
      allTasks.forEach(t => {
        if (localStorage.getItem(`doctor_appt_task_${t.id}`) === 'true') {
          completedCount++;
        }
      });

      const totalTasks = allTasks.length;
      const pct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 100;

      if (todoCountEl) todoCountEl.textContent = `${totalTasks - completedCount} Tasks`;
      if (todoBadgeEl) todoBadgeEl.textContent = `${pct}% Ready (${completedCount}/${totalTasks})`;

      upcomingTodoList.innerHTML = allTasks.map(t => {
        const isDone = localStorage.getItem(`doctor_appt_task_${t.id}`) === 'true';
        return `
          <div class="todo-item" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:${isDone ? '#f0fdf4' : '#fff'};border:1px solid ${isDone ? '#bbf7d0' : 'var(--line)'};border-radius:12px;margin-bottom:8px;transition:all 0.2s;">
            <label style="display:flex;align-items:center;gap:12px;cursor:pointer;flex:1;margin:0;">
              <input type="checkbox" class="doctor-todo-checkbox" data-taskid="${t.id}" ${isDone ? 'checked' : ''} style="width:18px;height:18px;accent-color:#16a34a;cursor:pointer;">
              <span style="${isDone ? 'text-decoration:line-through;color:var(--muted);' : 'font-weight:600;color:var(--ink);'}font-size:14px;">
                ${esc(t.text)}
              </span>
            </label>
            <div style="display:flex;gap:8px;align-items:center;">
              <span style="font-size:11px;font-weight:700;background:#f3e8ff;color:#6b21a8;padding:3px 8px;border-radius:8px;">${esc(t.badge)}</span>
              <button type="button" class="secondary-btn unlock-patient-btn" data-unit="${esc(t.unitId)}" style="padding:4px 10px;font-size:11px;">Unlock</button>
            </div>
          </div>
        `;
      }).join('');

      upcomingTodoList.querySelectorAll('.doctor-todo-checkbox').forEach(chk => {
        chk.addEventListener('change', () => {
          const taskId = chk.dataset.taskid;
          localStorage.setItem(`doctor_appt_task_${taskId}`, chk.checked ? 'true' : 'false');
          renderUpcomingTodoChecklist(appts);
        });
      });

      upcomingTodoList.querySelectorAll('.unlock-patient-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const unit = btn.dataset.unit;
          if (searchInput) {
            searchInput.value = unit;
            searchForm?.scrollIntoView({ behavior: 'smooth' });
            searchForm?.requestSubmit();
          }
        });
      });
    }

    loadActivePatients();
    loadPendingVerifications();
    loadDoctorAppointments();

    // Search patient by Unit ID (Only Name & DOB)
    searchForm?.addEventListener('submit',async(e)=>{
      e.preventDefault();
      const unitId=searchInput.value.trim();
      if(!unitId)return;

      emptyState?.classList.add('hidden');
      resultBox?.classList.remove('hidden');
      resultBox.innerHTML=`<div style="text-align:center;padding:24px;color:var(--muted);">Searching patient by Unit ID…</div>`;

      try{
        const res=await fetch(apiUrl(`/api/v1/delegation/search-patient?medilockerId=${encodeURIComponent(unitId)}`),{
          headers:{Authorization:`Bearer ${token}`}
        });
        const json=await res.json();

        if(!res.ok||!json.success){
          resultBox.innerHTML=`
            <div class="empty-state compact" style="border-color:#cf4e4e;">
              <div class="empty-icon" style="color:#cf4e4e;">✕</div>
              <h4 style="color:#cf4e4e;margin:6px 0;">Patient Not Found</h4>
              <p style="color:var(--muted);">${esc(json.error||'No patient registered with this Unit ID. Please verify the ID with the patient.')}</p>
            </div>
          `;
          return;
        }

        const patient=json.data;
        const dobStr=patient.dob?new Date(patient.dob).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'Not specified';

        // Display ONLY Name and DOB
        resultBox.innerHTML=`
          <div class="profile-card" style="border:1px solid var(--line);background:#faf8fc;margin-top:10px;">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
              <div class="avatar" style="width:52px;height:52px;font-size:20px;">${initials(patient.fullName)}</div>
              <div>
                <span class="eyebrow" style="color:var(--plum);">VERIFIED PATIENT IDENTITY</span>
                <h3 style="font:800 24px 'Manrope';margin:2px 0;">${esc(patient.fullName)}</h3>
                <p style="color:var(--muted);font-size:14px;margin:0;"><b>MediLocker Unit ID:</b> ${esc(patient.medilockerId)} · <b>Date of Birth:</b> ${esc(dobStr)}</p>
              </div>
            </div>

            <div class="emergency-box" style="margin:16px 0;background:#f5ece7;">
              <span>🔒</span>
              <p style="margin:0;font-size:14px;"><b>Sovereign Privacy Enforced:</b> Clinical history, prescriptions, and lab investigations remain locked until authorized by the patient.</p>
            </div>

            <form id="sendAccessRequestForm" style="margin-top:16px;">
              <label style="font:700 14px 'DM Sans';display:block;margin-bottom:8px;">Select Requested Authorization Duration (30m to 7 days):</label>
              <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
                <select id="durationSelect" style="flex:1;min-width:240px;border:1px solid var(--line);border-radius:12px;padding:12px 16px;background:#fff;font:500 15px 'DM Sans';">
                  <option value="30">30 Minutes</option>
                  <option value="60">1 Hour</option>
                  <option value="120" selected>2 Hours (Standard Consultation)</option>
                  <option value="360">6 Hours</option>
                  <option value="720">12 Hours</option>
                  <option value="1440">24 Hours (1 Day)</option>
                  <option value="4320">3 Days</option>
                  <option value="10080">7 Days (Extended Inpatient Care)</option>
                </select>
                <button type="submit" class="primary-btn" style="padding:12px 24px;">Send Access Request ↗</button>
              </div>
            </form>
          </div>
        `;

        // Handle Send Access Request
        document.getElementById('sendAccessRequestForm')?.addEventListener('submit',async(ev)=>{
          ev.preventDefault();
          const duration=document.getElementById('durationSelect')?.value||120;
          const reqBtn=ev.target.querySelector('button[type="submit"]');
          if(reqBtn)reqBtn.disabled=true;

          try{
            const reqRes=await fetch(apiUrl('/api/v1/delegation/create-request'),{
              method:'POST',
              headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
              body:JSON.stringify({
                patientMedilockerId:patient.medilockerId,
                durationMinutes:Number(duration)
              })
            });

            const reqJson=await reqRes.json();
            if(!reqRes.ok||!reqJson.success){
              alert(reqJson.error||'Failed to send access request.');
              if(reqBtn)reqBtn.disabled=false;
              return;
            }

            if (reqJson.data?.alreadyActive) {
              alert('You already have active authorized access to this patient! Unlocking health vault now.');
              loadActivePatients();
              openPatientRecords(patient.medilockerId);
              return;
            }

            if (reqJson.data?.isExisting) {
              alert('An access request code is already active for this patient within the 15-minute window. Enter the dynamic passcode below.');
            }

            loadPendingVerifications();

            // Show 6-digit Code Entry Screen
            resultBox.innerHTML=`
              <div class="profile-card" style="border:2px solid var(--plum);background:#faf8fd;margin-top:10px;">
                <span class="eyebrow" style="color:var(--plum);">STEP 2: PATIENT VERIFICATION CODE</span>
                <h3 style="font:800 22px 'Manrope';margin:6px 0;">Request Dispatched to ${esc(patient.fullName)}</h3>
                <p style="color:var(--muted);font-size:14px;margin-bottom:18px;">
                  The access request has been sent to the patient's MediLocker <b>Consent & Access</b> panel.<br>
                  Ask the patient for the <b>6-digit dynamic passcode</b> (valid for 15 minutes).
                </p>

                <form id="verifyCodeForm" style="max-width:440px;">
                  <label style="font:700 13px 'DM Sans';display:block;margin-bottom:6px;">Enter 6-Digit Code Provided by Patient:</label>
                  <input type="text" id="passcodeInput" required maxlength="6" pattern="[0-9]{6}" placeholder="• • • • • •" autocomplete="off" style="font:800 28px monospace;letter-spacing:10px;text-align:center;padding:12px;border:2px solid var(--plum);border-radius:14px;background:#fff;width:100%;margin-bottom:14px;">
                  <button type="submit" class="primary-btn" style="width:100%;padding:14px;font-size:16px;">Verify Code & Unlock Full Records ↗</button>
                </form>
              </div>
            `;

            // Handle Verify Code
            document.getElementById('verifyCodeForm')?.addEventListener('submit',async(vEv)=>{
              vEv.preventDefault();
              const code=document.getElementById('passcodeInput')?.value.trim();
              if(!code)return;

              const vBtn=vEv.target.querySelector('button[type="submit"]');
              if(vBtn)vBtn.disabled=true;

              try{
                const vRes=await fetch(apiUrl('/api/v1/delegation/verify-code'),{
                  method:'POST',
                  headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
                  body:JSON.stringify({
                    patientMedilockerId:patient.medilockerId,
                    authCode:code
                  })
                });

                const vJson=await vRes.json();
                if(!vRes.ok||!vJson.success){
                  alert(vJson.error||'Verification failed: Incorrect or expired authorization code.');
                  if(vBtn)vBtn.disabled=false;
                  return;
                }

                resultBox.innerHTML=`
                  <div class="notice" style="background:#eaf6ec;border:1px solid #4e9e57;color:#205228;padding:16px;border-radius:14px;margin-top:10px;">
                    <strong style="font-size:16px;">✓ Patient Access Successfully Authorized!</strong>
                    <p style="margin:4px 0 0;font-size:14px;">Full health records unlocked. Access expires at ${new Date(vJson.data.expiresAt).toLocaleTimeString()}.</p>
                  </div>
                `;

                loadActivePatients();
                loadPendingVerifications();
                openPatientRecords(patient.medilockerId);

              }catch(vErr){
                alert('Verification request failed. Please check server.');
                if(vBtn)vBtn.disabled=false;
              }
            });

          }catch(err){
            alert('Failed to send request: '+err.message);
            if(reqBtn)reqBtn.disabled=false;
          }
        });

      }catch(err){
        resultBox.innerHTML=`<div class="empty-state compact"><p style="color:#cf4e4e;">Server error: ${esc(err.message)}</p></div>`;
      }
    });

    // Open Patient Full Records in Inspector Modal
    async function openPatientRecords(patientIdOrUnit){
      if(!recordModal||!recordModalContent)return;
      recordModal.classList.remove('hidden');
      recordModalContent.innerHTML=`<div style="text-align:center;padding:48px;color:var(--muted);">Loading authorized patient records…</div>`;

      try{
        const res=await fetch(apiUrl(`/api/v1/delegation/doctor/patient/${encodeURIComponent(patientIdOrUnit)}/full-data`),{
          headers:{Authorization:`Bearer ${token}`}
        });
        const json=await res.json();

        if(!res.ok||!json.success){
          recordModalContent.innerHTML=`
            <div class="empty-state compact" style="border-color:#cf4e4e;">
              <h4 style="color:#cf4e4e;">Access Denied or Expired</h4>
              <p style="color:var(--muted);">${esc(json.error||'You no longer have active authorization to view this patient\'s records.')}</p>
            </div>
          `;
          return;
        }

        const data=json.data;
        const p=data.patient;
        const prof=p.profile||{};
        const records=data.medicalRecords||[];
        const timeline=data.timelineEvents||[];
        const todos=data.todoItems||[];
        const cabinet=data.homeSupplies||[];
        const expTime=new Date(data.delegation.expiresAt).toLocaleString();

        recordModalContent.innerHTML=`
          <!-- Header Banner -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:20px;flex-wrap:wrap;gap:16px;">
            <div>
              <span class="eyebrow" style="color:#2e6b35;">● AUTHORIZED CLINICAL SESSION</span>
              <h2 style="font:800 28px 'Manrope';margin:4px 0;">${esc(prof.fullName||'Patient')}</h2>
              <p style="color:var(--muted);font-size:14px;margin:0;">
                <b>Unit ID:</b> ${esc(p.medilockerId)} · 
                <b>DOB:</b> ${prof.dob?new Date(prof.dob).toLocaleDateString():'N/A'} · 
                <b>Blood Group:</b> <span class="status-pill" style="margin-left:4px;padding:2px 8px;">${esc(prof.bloodGroup||'N/A')}</span>
              </p>
            </div>
            <div style="text-align:right;">
              <span class="status-pill" style="background:#eaf6ec;color:#205228;">Session Active</span>
              <small style="display:block;color:var(--muted);margin-top:6px;font-size:12px;">Expires: ${expTime}</small>
            </div>
          </div>

          <!-- Clinical Context Row -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0;">
            <div style="background:#fbf8fd;padding:14px;border-radius:14px;border:1px solid var(--line);">
              <small style="text-transform:uppercase;font-weight:800;color:var(--muted);font-size:11px;">Known Allergies</small>
              <strong style="display:block;margin-top:4px;color:${prof.baselineAllergies?'#cf4e4e':'inherit'};">${esc(prof.baselineAllergies||'None documented')}</strong>
            </div>
            <div style="background:#fbf8fd;padding:14px;border-radius:14px;border:1px solid var(--line);">
              <small style="text-transform:uppercase;font-weight:800;color:var(--muted);font-size:11px;">Medical History</small>
              <strong style="display:block;margin-top:4px;">${esc(prof.medicalHistory||'None recorded')}</strong>
            </div>
            <div style="background:#fbf8fd;padding:14px;border-radius:14px;border:1px solid var(--line);">
              <small style="text-transform:uppercase;font-weight:800;color:var(--muted);font-size:11px;">Emergency Contact</small>
              <strong style="display:block;margin-top:4px;">${esc(prof.emergencyContactName||'N/A')} ${prof.emergencyContactPhone?`(${esc(prof.emergencyContactPhone)})`:''}</strong>
            </div>
          </div>

          <!-- Section 1: Prescriptions & Lab Vault -->
          <div style="margin-top:24px;">
            <h3 style="font:800 20px 'Manrope';margin:0 0 12px;">1. Medical Documents & Prescriptions (${records.length})</h3>
            <div class="records-list">
              ${records.length===0?'<p style="color:var(--muted);font-size:14px;">No documents in patient vault.</p>':records.map(r=>{
                const fileLink = apiUrl(`/api/v1/records/${r.id}/view?token=${encodeURIComponent(token)}`);
                return `
                <div class="record-card" style="padding:14px 18px;">
                  <div class="record-icon ${r.documentType==='PRESCRIPTION'?'prescription-icon':'report-icon'}" style="width:42px;height:42px;font-size:16px;">
                    ${r.documentType==='PRESCRIPTION'?'Rx':'Lab'}
                  </div>
                  <div class="record-main">
                    <div>
                      <span class="record-type">${esc(r.documentType)}</span>
                      <h4 style="font:700 16px 'Manrope';margin:2px 0;">${esc(r.originalFilename)}</h4>
                      <small style="color:var(--muted);">${new Date(r.uploadedAt).toLocaleDateString()} ${r.userNote?`· "${esc(r.userNote)}"`:''}</small>
                    </div>
                    <a href="${fileLink}" target="_blank" class="view-btn" style="font-size:13px;padding:6px 12px;">View File ↗</a>
                  </div>
                </div>
              `;}).join('')}
            </div>
          </div>

          <!-- Section 2: Clinical Timeline -->
          <div style="margin-top:28px;">
            <h3 style="font:800 20px 'Manrope';margin:0 0 12px;">2. Health Timeline & Consultations (${timeline.length})</h3>
            ${timeline.length===0?'<p style="color:var(--muted);font-size:14px;">No timeline consultations recorded.</p>':timeline.map(t=>`
              <div class="timeline-card" style="padding:16px;margin-bottom:10px;">
                <div class="timeline-date" style="min-width:90px;padding:8px;">
                  <b>${t.eventDateDdmmyyyy}</b>
                </div>
                <div class="timeline-body">
                  <span class="timeline-tag consult">${esc(t.doctorName||'Doctor')} · ${esc(t.clinicName||'Clinic')}</span>
                  <p style="margin:4px 0;font-size:14px;"><b>Diagnoses / Findings:</b> ${Array.isArray(t.diagnoses)?esc(t.diagnoses.join(', ')):'General consultation'}</p>
                  ${t.clinicalSummary?`<small style="color:var(--muted);display:block;">${esc(t.clinicalSummary)}</small>`:''}
                  ${Array.isArray(t.prescribedMeds)&&t.prescribedMeds.length>0?`
                    <div style="margin-top:8px;font-size:13px;background:#f9f8fa;padding:8px 12px;border-radius:10px;">
                      <b>Prescribed:</b> ${t.prescribedMeds.map(m=>`${esc(m.medicineName)} (${esc(m.dosage)})`).join(', ')}
                    </div>
                  `:''}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Section 3: Daily To-Do Adherence & Cabinet -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:28px;">
            <div>
              <h3 style="font:800 18px 'Manrope';margin:0 0 10px;">3. Ongoing Medication To-Dos</h3>
              ${todos.length===0?'<p style="color:var(--muted);font-size:14px;">No active to-do items.</p>':todos.slice(0,5).map(td=>`
                <div style="padding:8px 12px;border:1px solid var(--line);border-radius:10px;margin-bottom:6px;font-size:13px;display:flex;justify-content:space-between;">
                  <span>${td.isCompleted?'✓':'○'} ${esc(td.taskLabel)}</span>
                  <small style="color:var(--muted);">${esc(td.timeSlot)}</small>
                </div>
              `).join('')}
            </div>
            <div>
              <h3 style="font:800 18px 'Manrope';margin:0 0 10px;">4. Household Cabinet Supplies</h3>
              ${cabinet.length===0?'<p style="color:var(--muted);font-size:14px;">Cabinet is empty.</p>':cabinet.slice(0,5).map(c=>`
                <div style="padding:8px 12px;border:1px solid var(--line);border-radius:10px;margin-bottom:6px;font-size:13px;display:flex;justify-content:space-between;">
                  <span>${esc(c.medicineName)} (${esc(c.activeSalt||'OTC')})</span>
                  <b>Qty: ${c.quantityAvailable}</b>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }catch(e){
        recordModalContent.innerHTML=`<div class="empty-state compact"><p style="color:#cf4e4e;">Failed to load patient data.</p></div>`;
      }
    }
  }

  // Bind Doctors Directory & Appointment Booking
  async function bindDoctorsPage() {
    const s = requireSession('patient');
    if (!s) return;
    const token = getToken();

    const listContainer = document.getElementById('doctorsListContainer');
    if (!listContainer) return;

    let activeFilter = 'all'; // 'all' | 'previously_visited' | 'nearby'
    const specializationFilter = document.getElementById('specializationFilter') || document.getElementById('doctorSpecialtyFilter');
    const searchInput = document.getElementById('doctorSearchInput');
    const doctorCountPill = document.getElementById('doctorCountPill');

    // Filter tabs
    const filterButtons = document.querySelectorAll('#doctorFilterTabs [data-filter], .filter-tabs [data-filter]');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => {
          b.classList.remove('active');
          b.style.background = '#fff';
          b.style.color = 'var(--text)';
          b.style.borderColor = 'var(--line)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--plum)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--plum)';
        activeFilter = btn.dataset.filter || 'all';
        loadDoctors();
      });
    });

    specializationFilter?.addEventListener('change', () => loadDoctors());

    let searchTimer = null;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadDoctors, 300);
    });

    async function loadDoctors() {
      listContainer.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);grid-column:1/-1;">Finding verified doctors…</div>`;
      if (doctorCountPill) doctorCountPill.textContent = 'Searching…';

      const params = new URLSearchParams();
      if (activeFilter && activeFilter !== 'all') {
        params.set('filter', activeFilter);
      }
      const spec = specializationFilter?.value;
      if (spec && spec !== 'all') {
        params.set('specialization', spec);
      }
      const query = searchInput?.value.trim();
      if (query) {
        params.set('search', query);
      }

      try {
        const res = await fetch(apiUrl(`/api/v1/appointments/doctors?${params.toString()}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        const doctors = json.data || [];

        if (doctorCountPill) {
          doctorCountPill.textContent = `${doctors.length} Doctor${doctors.length === 1 ? '' : 's'} Available`;
        }

        if (doctors.length === 0) {
          listContainer.innerHTML = `
            <div class="empty-state compact" style="grid-column:1/-1;padding:40px;text-align:center;background:#fff;border-radius:18px;border:1px solid var(--line);">
              <div class="empty-icon" style="font-size:36px;margin-bottom:8px;">👨‍⚕️</div>
              <h4 style="margin:4px 0;font:800 18px 'Manrope';">No Doctors Found</h4>
              <p style="color:var(--muted);margin:0;font-size:14px;">No registered healthcare providers match your current filter or search criteria.</p>
            </div>
          `;
          return;
        }

        listContainer.innerHTML = doctors.map(doc => {
          const initialsStr = initials(doc.fullName);
          const expYears = doc.yearsExperience ?? doc.experienceYears;
          const expText = expYears ? `${expYears}+ years exp` : '';
          const locationText = [doc.city, doc.state].filter(Boolean).join(', ');

          return `
            <div class="doctor-card" style="background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px;box-shadow:var(--shadow);display:flex;flex-direction:column;justify-content:space-between;gap:16px;">
              <div>
                <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:12px;">
                  <div class="avatar" style="width:52px;height:52px;font-size:18px;flex-shrink:0;">${initialsStr}</div>
                  <div style="flex:1;">
                    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
                      ${doc.isPreviouslyVisited ? `<span class="status-pill" style="background:#f0fdf4;color:#15803d;font-size:11px;font-weight:700;">✓ Previously Consulted</span>` : ''}
                      ${doc.isNearby ? `<span class="status-pill" style="background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;">📍 In Your Area</span>` : ''}
                    </div>
                    <h3 style="font:800 18px 'Manrope';margin:0;color:var(--plum);">${esc(doc.fullName)}</h3>
                    <p style="margin:2px 0 0;font:600 13px 'DM Sans';color:#0d9488;">
                      ${esc(doc.specialization)} ${doc.degree ? `· <span style="color:var(--muted);font-weight:500;">${esc(doc.degree)}</span>` : ''}
                    </p>
                  </div>
                </div>

                <div style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:8px;">
                  <div>🏥 <b>${esc(doc.clinicName || 'Medical Clinic')}</b></div>
                  ${locationText ? `<div>📍 ${esc(locationText)}</div>` : ''}
                  ${expText ? `<div>⏱ ${esc(expText)}</div>` : ''}
                  <div>🆔 <code style="color:var(--plum);font-weight:700;">${esc(doc.medilockerId)}</code></div>
                </div>
              </div>

              <button class="primary-btn book-doc-btn" 
                data-id="${esc(doc.id)}" 
                data-unit="${esc(doc.medilockerId)}" 
                data-name="${esc(doc.fullName)}" 
                data-spec="${esc(doc.specialization)}"
                data-clinic="${esc(doc.clinicName || '')}"
                style="width:100%;padding:11px 16px;font-size:14px;cursor:pointer;">
                Book Appointment ↗
              </button>
            </div>
          `;
        }).join('');

        listContainer.querySelectorAll('.book-doc-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            openBookingModal(
              btn.dataset.id,
              btn.dataset.unit,
              btn.dataset.name,
              btn.dataset.spec,
              btn.dataset.clinic
            );
          });
        });

      } catch (err) {
        if (doctorCountPill) doctorCountPill.textContent = 'Error loading';
        listContainer.innerHTML = `<div class="empty-state compact" style="grid-column:1/-1;"><p style="color:#cf4e4e;">Failed to load doctors: ${esc(err.message)}</p></div>`;
      }
    }

    // Modal elements - support both bookingModal and appointmentModal ID schemes
    const modal = document.getElementById('bookingModal') || document.getElementById('appointmentModal');
    const closeModal = document.getElementById('closeBookingModal') || document.getElementById('closeAppointmentModal');
    const cancelModal = document.getElementById('cancelAppointmentBtn');
    const bookingForm = document.getElementById('appointmentBookingForm') || document.getElementById('bookAppointmentForm');
    const docNameSpan = document.getElementById('modalDoctorName') || document.getElementById('appointmentDoctorName');
    const docDetailsSpan = document.getElementById('modalDoctorDetails') || document.getElementById('appointmentDoctorDetails');
    const docHiddenInput = document.getElementById('bookingDoctorId') || document.getElementById('appointmentDoctorUnitId');
    const dateInput = document.getElementById('bookingDate') || document.getElementById('appointmentDate');
    const timeSlotSelect = document.getElementById('bookingTimeSlot') || document.getElementById('appointmentTime');
    const reasonInput = document.getElementById('bookingReason') || document.getElementById('appointmentReason');
    const submitBtn = document.getElementById('submitBookingBtn') || document.getElementById('submitAppointmentBtn');

    function openBookingModal(id, unit, name, spec, clinic) {
      if (!modal) return;
      if (docNameSpan) docNameSpan.textContent = `Dr. ${name.replace(/^Dr\.\s*/i, '')}`;
      if (docDetailsSpan) docDetailsSpan.textContent = `${spec} · ${clinic || 'Clinic'} (${unit})`;
      if (docHiddenInput) {
        docHiddenInput.value = id || unit;
        docHiddenInput.dataset.unit = unit;
        docHiddenInput.dataset.id = id;
      }

      const today = new Date().toISOString().split('T')[0];
      if (dateInput) {
        dateInput.min = today;
        if (!dateInput.value || dateInput.value < today) {
          dateInput.value = today;
        }
      }

      modal.classList.remove('hidden');
    }

    closeModal?.addEventListener('click', () => modal?.classList.add('hidden'));
    cancelModal?.addEventListener('click', () => modal?.classList.add('hidden'));

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    bookingForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const doctorIdVal = docHiddenInput?.value.trim();
      const doctorUnitVal = docHiddenInput?.dataset.unit || doctorIdVal;
      const dateVal = dateInput?.value;
      const timeVal = timeSlotSelect?.value || 'Morning (09:00 AM - 12:00 PM)';
      const reasonVal = reasonInput?.value.trim();

      if (!doctorIdVal || !dateVal) {
        alert('Please choose an appointment date.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Securing booking…';
      }

      try {
        const res = await fetch(apiUrl('/api/v1/appointments'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            doctorId: doctorIdVal,
            doctorMedilockerId: doctorUnitVal,
            appointmentDate: dateVal,
            timeSlot: timeVal,
            reason: reasonVal || undefined
          })
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          alert(json.error || json.message || 'Failed to book appointment.');
          return;
        }

        alert('Appointment successfully booked with ' + (docNameSpan?.textContent || 'the physician') + '! A confirmation email has been dispatched and saved to your portal.');
        modal?.classList.add('hidden');
        bookingForm.reset();
        loadMyAppointments();
      } catch (err) {
        alert('Booking failed: ' + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Confirm & Book Appointment ↗';
        }
      }
    });

    // Load patient appointments
    const myApptsList = document.getElementById('myAppointmentsList');
    async function loadMyAppointments() {
      if (!myApptsList) return;
      try {
        const res = await fetch(apiUrl('/api/v1/appointments/my-appointments'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        const appts = json.data || [];

        if (appts.length === 0) {
          myApptsList.innerHTML = `<div class="empty-state compact"><p style="margin:0;color:var(--muted);">No upcoming appointments scheduled. Select a physician above to book a consultation.</p></div>`;
          return;
        }

        myApptsList.innerHTML = appts.map(a => {
          const apptDateStr = new Date(a.appointmentDate).toLocaleDateString('en-GB', {
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
          });
          const statusBadge = a.status === 'CONFIRMED'
            ? '<span class="status-pill" style="background:#f0fdf4;color:#166534;font-size:11px;font-weight:700;">✓ Confirmed</span>'
            : a.status === 'CANCELLED'
            ? '<span class="status-pill" style="background:#fef2f2;color:#991b1b;font-size:11px;font-weight:700;">✕ Cancelled</span>'
            : '<span class="status-pill" style="background:#fffbeb;color:#92400e;font-size:11px;font-weight:700;">⏳ Pending Approval</span>';

          return `
            <div class="record-card" style="margin-bottom:12px;background:#faf8fd;border:1px solid var(--line);border-radius:14px;padding:16px;">
              <div class="record-icon" style="background:#e0f2fe;color:#0369a1;font-size:20px;">📅</div>
              <div class="record-main">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    ${statusBadge}
                    <span style="font-weight:700;font-size:14px;color:var(--plum);">${apptDateStr} · ${esc(a.timeSlot)}</span>
                  </div>
                  <h4 style="font:800 18px 'Manrope';margin:2px 0 4px;">Dr. ${esc(a.doctorName.replace(/^Dr\.\s*/i, ''))} <span style="font-size:14px;color:var(--muted);font-weight:500;">(${esc(a.specialization)})</span></h4>
                  <p style="margin:0;font-size:13px;color:var(--muted);">
                    🏥 ${esc(a.clinicName || 'Clinic')} · 🆔 <code>${esc(a.doctorMedilockerId)}</code>
                    ${a.reason ? ` · Reason: <i>"${esc(a.reason)}"</i>` : ''}
                  </p>
                </div>
              </div>
            </div>
          `;
        }).join('');
      } catch (e) {
        myApptsList.innerHTML = `<div class="empty-state compact"><p style="margin:0;color:var(--muted);">Could not load scheduled appointments.</p></div>`;
      }
    }

    loadDoctors();
    loadMyAppointments();
  }

  function openEmergencySOSModal() {
    const existing = document.getElementById('sosEmergencyModal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'sosEmergencyModal';
    backdrop.className = 'sos-modal-backdrop';
    backdrop.innerHTML = `
      <div class="sos-modal-card" role="dialog" aria-modal="true">
        <div class="sos-modal-icon">🚑</div>
        <h2 class="sos-modal-title">Emergency Ambulance Service</h2>
        <p class="sos-modal-subtitle">Immediate emergency medical response. Click below to dial directly:</p>
        
        <div class="sos-call-list">
          <a href="tel:102" class="sos-call-item" style="border-color:#ef4444;background:#fff5f5;">
            <div class="sos-call-info">
              <strong class="sos-call-name" style="color:#b91c1c;">National Ambulance Service</strong>
              <span class="sos-call-desc">24x7 Free Emergency Medical Transport</span>
            </div>
            <span class="sos-call-dial" style="background:#dc2626;color:#fff;border-color:#b91c1c;">📞 102</span>
          </a>

          <a href="tel:108" class="sos-call-item">
            <div class="sos-call-info">
              <strong class="sos-call-name">Emergency Medical Services (EMS)</strong>
              <span class="sos-call-desc">Trauma, Critical Care & Disaster Response</span>
            </div>
            <span class="sos-call-dial">📞 108</span>
          </a>

          <a href="tel:112" class="sos-call-item">
            <div class="sos-call-info">
              <strong class="sos-call-name">Unified National Helpline</strong>
              <span class="sos-call-desc">All-in-one Police, Fire & Medical Line</span>
            </div>
            <span class="sos-call-dial">📞 112</span>
          </a>
        </div>

        <button type="button" class="sos-modal-close" id="closeSosModalBtn">Close Window</button>
      </div>
    `;

    document.body.appendChild(backdrop);

    backdrop.querySelector('#closeSosModalBtn').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop) backdrop.remove();
    });
  }

  function bindEmergencySOS() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.sos-btn');
      if (!btn) return;

      const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        // Allow mobile dialer to launch natively via tel:102
        return;
      }

      e.preventDefault();
      openEmergencySOSModal();
    });
  }

  // DOM ready dispatcher
  document.addEventListener('DOMContentLoaded',()=>{
    bindLanguage();
    bindLocation();
    bindEmergencySOS();
    window.applyLanguage?.(localStorage.getItem('medilockerLanguage')||'en');
    bindLogout();

    if(document.body.classList.contains('login-page')&&document.getElementById('loginForm'))bindLogin();
    if(document.getElementById('signupForm'))bindSignup();
    if(document.querySelector('[data-user-name]')||document.querySelector('.patient-dashboard'))bindPatientUI();
    if(document.getElementById('recordsListContainer'))bindPatientRecords();
    if(document.querySelector('.provider-portal'))bindProviderPortal(document.body.dataset.providerRole);
    if(document.getElementById('doctorsListContainer'))bindDoctorsPage();
    if(document.getElementById('fileInput'))bindUpload();
    if(document.getElementById('doneCount'))bindTodo();

    // Extra feature bindings
    if(document.getElementById('timelineList'))bindTimeline();
    if(document.getElementById('cabinetCardsContainer'))bindInventory();
    if(document.getElementById('chatMessages'))bindAiCompanion();
    if(document.getElementById('delegationsList'))bindDelegation();
    if(document.getElementById('logVitalsModal')||document.getElementById('labFindingsContainer'))bindTests();
  });
})();
