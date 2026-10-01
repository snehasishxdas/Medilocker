# MediLocker 🏥🔐
> **A Sovereign, ABHA-Aligned Digital Health Sanctuary & Clinical Ecosystem**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)

---

## 🌟 Executive Summary

**MediLocker** is a production-grade, patient-sovereign digital healthcare management ecosystem built to solve fragmented medical histories, unorganized paper prescriptions, medication non-adherence, and unauthorized clinical data exposure. 

Aligned with the architectural tenets of the **Ayushman Bharat Digital Mission (ABDM)**, MediLocker equips patients with a unique, permanent digital health identifier (`ML-XXX-XXX-XXX`), automated multimodal AI prescription digitization, home medicine inventory scanning, and a secure, time-bounded **6-digit OTP doctor-patient authorization gateway**.

MediLocker operates with **zero mock data and zero artificial fallbacks**: every account, prescription, daily routine checklist, cabinet inventory item, and clinical delegation is persisted in real-time across a live **Supabase PostgreSQL** database engine and **Supabase Object Storage**.

---

## 🚀 Core Features Catalog

### 1. 🪪 ABHA-Aligned Digital Health Identifier & Registration Onboarding
- **Deterministic Identity Generation**: Every registered patient, doctor, and hospital receives a unique, formatted MediLocker Unit ID (e.g., `ML-829-410-994`).
- **Post-Registration Unit ID Popup Modal**: Upon registration in any of the 3 portals (**Patient**, **Doctor**, **Hospital**), a dedicated confirmation popup displays:
  - The newly generated **Unit ID** with a 1-click clipboard copy button.
  - The associated registered email address.
  - An onboarding advisory detailing that either the **Password** OR **Unit ID** can be used along with their email to sign in.
- **Strict Deduplication**: Enforces exactly one unique account per verified email address.
- **Role-Based Isolation**: Three specialized personas: **Patient**, **Doctor**, and **Hospital**, each with dedicated data schemas, access controls, and authentication barriers.

### 2. 🔑 Flexible Dual-Credential Authentication (Password OR Unit ID)
- **Dual-Method Login Gateway**: Users across all three portals can authenticate using their registered email and **EITHER**:
  1. 🔑 **Account Password / MPIN** (hashed with Argon2id), OR
  2. 🪪 **Unique MediLocker Unit ID** (`ML-XXX-XXX-XXX`).
- **Interactive UI Credential Toggle**: Modern, responsive interface allowing seamless selection between Password and Unit ID login modes with instant client-side validation.

### 3. ✉️ Multi-Trigger Automated Email Notification Service
MediLocker incorporates a zero-block, high-reliability email dispatch engine supporting direct SMTP, Google Apps Script HTTPS Relay, Resend API, and Brevo API:
- **Registration Welcome Email**: Dispatched on Patient, Doctor, or Hospital onboarding containing their Unit ID, role capabilities, and security guidelines.
- **Doctor Appointment Booking & Status**:
  - *Booking Confirmation*: Instant confirmation to the patient with physician details, clinic address, date, time slot, and check-in guidance.
  - *Physician Alert*: Real-time notification to the doctor with patient name, appointment time, and clinical reason.
  - *Status Update Alerts*: Automated notifications when appointments are confirmed, completed, or rescheduled.
- **Prescription & Health Record Upload Notification**:
  - *Patient Vault Confirmation*: Informs the patient upon document upload, displaying the document type, original filename, prescribing doctor, and AI-extracted medications added to their To-Do list.
  - *Doctor Active Session Notification*: Alerts attending doctors when a patient uploads a new document during an active consultation session.
- **Doctor Permission & Consent Access Tickets**:
  - *Dynamic 6-Digit Passcode Ticket*: Dispatches an expiring 6-digit numeric OTP to the patient when a doctor requests access.
  - *Session Authorization Notice*: Confirms when clinical access has been granted, including session duration and expiration timestamp.
- **Adverse Symptom Advisory Alerts**: Automated high-priority alerts triggered when patients log critical discomfort scores.

### 4. 📄 Multimodal AI Clinical OCR & Ingestion (Google Gemini Vision)
- **Zero-Manual Entry**: Patients take a photo or upload a PDF of handwritten prescriptions, lab diagnostic sheets, or hospital discharge summaries.
- **Clinical Entity Extraction**: Automatically recognizes:
  - Prescribing Physician Name & Medical Clinic / Hospital Name.
  - Clinical Diagnoses & Detected Allergies.
  - Prescribed Medicines, Dosages, Formulations (tablets, capsules, syrups), Administration Routes, and Duration.
  - Prescribed Diagnostic Tests & Follow-Up schedules.

### 5. 📅 Interactive Chronological Health Timeline
- **Holistic Care History**: Weaves all historical clinical encounters into an interactive, chronological timeline.
- **Categorical Filtering**: Instant filtering across **Prescriptions**, **Lab Reports**, **Scans**, and **Hospital Admissions**.
- **Deep Search**: Instant query search across past diagnoses, clinics, doctors, and active medication courses.

### 6. 💊 Smart Medication To-Do & Adherence Scoring
- **Automated Routine Conversion**: Extracted prescription items automatically populate into four structured daily intake slots:
  - 🌅 **Morning** (e.g., *After breakfast · 8:00 AM*)
  - ☀️ **Afternoon** (e.g., *After lunch · 1:30 PM*)
  - 🌇 **Evening** (e.g., *Snack time · 5:30 PM*)
  - 🌙 **Night** (e.g., *After dinner · 9:00 PM*)
- **Circular Adherence Ring**: Dynamic adherence progress ring (`0%` to `100%`) reflecting real-time checklist completions.

### 7. ❤️ Daily Feeling & Severity Assessment
- **5-Point Wellness Log**: Patients record daily feelings: **Great**, **Good**, **Okay**, **Poor**, or **Critical**.
- **7-Day Visual Heatmap**: Real-time visual tracking of holistic recovery and pain trends.
- **Clinical Severity Triggers**: Poor or Critical ratings automatically trigger safety notices and prompt consultations.

### 8. 📦 Household Medicine Cabinet & Barcode/Batch Scanner
- **Home First-Aid & Pharmacy Management**: Keep inventory of medicine boxes at home.
- **GTIN Barcode & Camera Feed Batch Reader**: Scan standard barcodes or capture pharmaceutical batch codes from live camera feeds to fetch therapeutic uses, precautions, and active salts.
- **5-Day Refill Alerts**: Automated background cron calculations flag supplies running under 5 days and provide direct reorder guidance.

### 9. 🤖 Clinical Medi-AI Companion with Guardrails
- **Evidence-Based Patient Guidance**: Safe first-aid, lifestyle recommendations, and symptom triaging.
- **Strict Guardrail Policies**:
  - 🚫 **Non-Medical Interceptor**: Blocks programming/coding queries, math, and trivia with an out-of-scope notice.
  - 🚫 **Prescription Drug Gating**: Refuses to autonomously prescribe Schedule H/X controlled drugs or dangerous medications.
  - ⚠️ **Allergy & Drug Conflict Check**: Cross-references user allergy history and ongoing medications before suggesting OTC remedies.
  - 📌 **Concise Pin-Point Formatting**: Structured bullet points with mandatory clinical disclaimers.

### 10. 🔐 Time-Bounded Doctor Access Delegation & 6-Digit OTP
- **Quarantined Patient Search**: Doctor search by patient Unit ID (`ML-XXX-XXX-XXX`) returns **strictly Full Name and DOB**. Zero medical records or prescriptions are exposed during lookup.
- **Configurable Access Duration**: Doctor selects authorization duration from **30 minutes up to 7 days** (30m, 1h, 2h, 6h, 12h, 24h, 3d, 7d).
- **Dynamic 15-Minute 6-Digit Passcode**: Request appears on the patient's **Consent & Access** dashboard and email displaying doctor credentials and an expiring 6-digit numeric OTP.
- **Two-Factor Access Unlock**: Doctor enters the 6-digit passcode to unlock complete patient records, timeline, to-dos, and cabinet.
- **1-Click Immediate Revocation**: Patients retain full sovereignty and can terminate active doctor authorizations at any second with a single click.

### 11. 🩺 Doctor Discovery & Clinic Appointment Booking
- **Smart Directory Filtering**: Patients can search and filter verified physicians:
  - **All Doctors**: Browse all empanelled specialists with experience, degree (MBBS/MD), and clinic addresses.
  - **Previously Visited**: Auto-detects doctors who previously treated the patient or reviewed their records.
  - **Nearby Clinics**: Proximity matching comparing doctor clinic locations with patient residence.
- **Interactive Booking Engine**: Select appointment dates, time slots, and clinical reasons.
- **Doctor Workspace Queue & Pre-Consultation Checklist**:
  - **Today's Appointments Queue**: Immediate patient consultation schedule.
  - **Pre-Consultation Clinical Action Items**: Inspect past lab files, verify vitals, and prepare prescriptions.
  - **Status Controls**: One-click status updates (`Confirm`, `Complete`, `Cancel`) with automated patient updates.

### 12. 🏥 Dedicated Healthcare Provider Portals & Hospital Doctor Management
- **Doctor Portal**: Verifiable Medical Registration Numbers (NMC/State Council), patient Unit ID lookups, access requests, and historical record viewing.
- **Hospital Portal**: Institutional staff allocations, doctor empanelment, bed capacity tracking, and department auditing.
- **Immutable Audit Logging**: Every access grant, record view, and search is logged in the `audit_logs` table with IP address, user agent, and timestamp.

### 13. 🌐 Universal Accessibility & Multilingual Localization
- Real-time client-side localization across 7 languages:
  - **English**, **বাংলা (Bengali)**, **हिन्दी (Hindi)**, **मराठी (Marathi)**, **اردو (Urdu - RTL)**, **ਪੰਜਾਬੀ (Punjabi)**, and **ಕನ್ನಡ (Kannada)**.

---

## 🏗️ Technical Architecture

```
                               ┌───────────────────────────────────────────────┐
                               │           Client Layer (React 19 / Vite 5)    │
                               │  HTML5 + Vanilla CSS3 (Design Tokens) + JS    │
                               │  - Patient Portal        - Doctor Portal      │
                               │  - Hospital Portal       - Medi-AI Companion  │
                               │  - Dual-Auth Gateway     - Registration Modal │
                               └──────────────────────┬────────────────────────┘
                                                      │ HTTPS / REST API
                                                      ▼
                               ┌───────────────────────────────────────────────┐
                               │           Backend API Layer (Port 5000)       │
                               │        Node.js + Express + TypeScript         │
                               ├───────────────────────────────────────────────┤
                               │ • Dual Credential Auth (Password OR Unit ID)  │
                               │ • Multi-Trigger Mailer Relay (Nodemailer/API) │
                               │ • Clinical Guardrails Engine (ai.guardrails)  │
                               │ • Multer File Ingestion & SHA-256 Checksums   │
                               │ • Background Cron Scheduler (Refills/Expiry)  │
                               │ • Delegation OTP Gateway (delegation.service) │
                               └───────┬───────────────────────────────┬───────┘
                                       │                               │
                      Prisma ORM (v5)  │                               │ Google Gemini AI
                                       ▼                               ▼
                 ┌───────────────────────────────┐      ┌─────────────────────────────┐
                 │    Supabase PostgreSQL        │      │    Gemini Multimodal AI     │
                 │  - users & profiles           │      │  - Prescription Vision OCR  │
                 │  - medical_records            │      │  - Batch Code Recognition   │
                 │  - timeline & prescriptions   │      │  - Symptom Triage Engine    │
                 │  - patient_access_delegations │      └─────────────────────────────┘
                 │  - audit_logs & appointments  │
                 └───────────────────────────────┘
```

---

## 📦 Complete Tech Stack

| Domain | Technology / Library | Description |
|---|---|---|
| **Frontend Framework** | **React 19 & React Router 7** | Component-driven SPA architecture with reactive state management and route guards. |
| **Build & Bundler** | **Vite 5** | Lightning-fast HMR and optimized production bundling with SPA fallback middleware. |
| **Design & UI** | **Vanilla CSS3 Design Tokens** | Handcrafted design system with glassmorphism, micro-animations, and Manrope / DM Sans typography. |
| **Icons & Media** | **Lucide React** | Lightweight, accessible medical and system iconography. |
| **Barcode & QR** | **jsQR & QRCode** | Real-time browser camera stream barcode scanning and cryptographic QR generation. |
| **Backend Runtime** | **Node.js (v18+) & Express.js** | Enterprise REST API server with compression, helmet security headers, and rate limiting. |
| **Language** | **TypeScript 5** | End-to-end type safety across backend schemas, controllers, and services. |
| **ORM & Schema** | **Prisma ORM (v5.22.0)** | Type-safe database client and automated migration management. |
| **Primary Database** | **PostgreSQL (Supabase)** | Cloud relational database with connection pooling and relational integrity. |
| **Cloud Storage** | **Supabase Object Storage / Cloudinary** | Encrypted medical record document and certificate storage with presigned access. |
| **AI Vision & NLP** | **Google Gemini 1.5 / 2.0 Flash** | Multimodal clinical document analysis, handwritten OCR, and structured JSON entity extraction. |
| **Authentication & Cryptography** | **Argon2id, SimpleWebAuthn, JWT** | Hardware-grade memory-hard password hashing, WebAuthn passkeys, and tamper-evident JWT tokens. |
| **Email & Notifications** | **Nodemailer & Zero-Block HTTPS Relay** | Multi-transport email dispatcher supporting Google Apps Script HTTPS Relay, Resend API, Brevo API, and SMTP. |
| **Caching Layer** | **Upstash Redis & Local SWR Cache** | Dual-tier distributed cache for sub-millisecond profile and token verification. |
| **Task Automation** | **node-cron** | Automated background cron jobs for midnight medication renewals and 5-day refill calculations. |

---

## 📁 Repository Structure

```
MediLocker/
├── frontend/                     # Client application (React 19 + Vite 5 + Static Web)
│   ├── src/
│   │   ├── components/           # Reusable UI components (Navbar, Modals, Cards)
│   │   ├── context/              # Global React Contexts (AuthContext)
│   │   ├── pages/                # Application views (Login, Signup, Dashboard, Records, Timeline, etc.)
│   │   ├── services/             # API client with SWR caching & session synchronization
│   │   └── App.jsx               # React Router configuration & layout bindings
│   ├── css/
│   │   └── style.css             # Core design system, design tokens & responsive utilities
│   ├── js/
│   │   ├── i18n.js               # 7-language localization dictionary
│   │   └── main.js               # Static portal event bindings & handlers
│   ├── login.html                # Role-aware authentication portal with Password / Unit ID toggles
│   ├── signup.html               # Registration & ABHA Unit ID popup modal
│   ├── dashboard.html            # Patient dashboard & health vitals overview
│   ├── records.html              # Medical records browser & document viewer
│   ├── upload.html               # Multi-document upload & AI OCR trigger
│   ├── medications.html          # Daily medication routine & adherence checklist
│   ├── timeline.html             # Chronological consultation & care timeline
│   ├── inventory.html            # Household medicine cabinet & barcode/batch scanner
│   ├── ai-companion.html         # Clinical Medi-AI assistant with safety guardrails
│   ├── delegation.html           # Doctor-patient consent requests & 6-digit OTP generator
│   ├── doctors.html              # Doctor directory & appointment booking portal
│   ├── doctor.html               # Verified doctor workspace with appointments queue
│   └── hospital.html             # Institutional healthcare administration portal
│
├── backend/                      # Server application (TypeScript)
│   ├── prisma/
│   │   ├── schema.prisma         # Complete PostgreSQL relational schema
│   │   └── supabase_schema.sql   # Direct SQL migration reference
│   ├── src/
│   │   ├── modules/
│   │   │   ├── ai/               # Gemini AI OCR, batch reader, and clinical guardrails
│   │   │   ├── appointments/     # Doctor booking, proximity filter, and status workflows
│   │   │   ├── auth/             # Dual-credential login, registration, and Unit ID generator
│   │   │   ├── delegation/       # 6-digit OTP generation, verification, and revocation
│   │   │   ├── inventory/        # Medicine cabinet, barcode GTIN, and refill tracking
│   │   │   ├── records/          # Document upload, storage, and AI timeline ingestion
│   │   │   ├── timeline/         # Chronological care events & feeling assessment
│   │   │   └── todo/             # Daily medication checklists & midnight renewals
│   │   ├── utils/
│   │   │   ├── mailer.ts         # Multi-trigger email notification engine & HTTPS relays
│   │   │   ├── cache.ts          # Upstash Redis & local in-memory dual cache layer
│   │   │   └── storage.ts        # Cloudinary & Supabase storage adapters
│   │   ├── workers/
│   │   │   └── cronScheduler.ts  # Background refill & midnight routine worker
│   │   ├── app.ts                # Express application configuration & middleware
│   │   └── server.ts             # Server entrypoint & HTTP listener
│   ├── package.json
│   └── tsconfig.json
│
├── package.json                  # Root workspace package for concurrent development
├── README.md                     # Comprehensive project documentation
└── .gitignore                    # Git tracking exemptions
```

---

## ⚡ Quick Start & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Supabase Account**: With PostgreSQL and Object Storage enabled

### 1. Clone the Repository
```bash
git clone https://github.com/Tridibesh-Sen/MediLocker.git
cd MediLocker
```

### 2. Install Dependencies
```bash
# Install workspace root, backend, and frontend dependencies
npm run install:all
```

### 3. Configure Environment Variables
Create a `.env` file in `backend/.env`:
```env
PORT=5000
NODE_ENV=development

# Database (Supabase PostgreSQL via IPv4 pooler)
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"

# Supabase (Storage & Platform)
SUPABASE_URL="https://[YOUR_PROJECT_ID].supabase.co"
SUPABASE_KEY="[YOUR_SUPABASE_SERVICE_ROLE_KEY]"
SUPABASE_ANON_KEY="[YOUR_SUPABASE_ANON_KEY]"
SUPABASE_BUCKET="medical-records"

# AI Inference (Gemini Vision & LLM)
GEMINI_API_KEY="[YOUR_GEMINI_API_KEY]"

# Security & Tokens
JWT_SECRET="medilocker_super_secret_production_key_2026"
JWT_EXPIRES_IN="2h"
CRON_SECRET="medilocker-cron-secret-2026"
CORS_ORIGIN="*"

# Upstash Redis Cache Layer
UPSTASH_REDIS_REST_URL="[YOUR_UPSTASH_URL]"
UPSTASH_REDIS_REST_TOKEN="[YOUR_UPSTASH_TOKEN]"

# Email Notifications (Google Apps Script HTTPS Relay or SMTP)
GMAIL_RELAY_URL="https://script.google.com/macros/s/.../exec"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER="[YOUR_EMAIL]@gmail.com"
SMTP_PASS="[YOUR_16_CHAR_APP_PASSWORD]"
SMTP_FROM="MediLocker <[YOUR_EMAIL]@gmail.com>"
```

### 4. Synchronize Database & Generate Prisma Client
```bash
cd backend
npx prisma generate
npx prisma db push
cd ..
```

### 5. Launch Development Servers
```bash
npm run dev
```
- 🌐 **Frontend UI**: [http://localhost:3000](http://localhost:3000)
- 📡 **Backend Core API**: [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)
- ✉️ **Email Diagnostic Health**: [http://localhost:5000/api/v1/health/email](http://localhost:5000/api/v1/health/email)

---

## 🔒 Clinical Safety & Security Model

1. **Patient Data Sovereignty**:
   Patients possess exclusive ownership over their medical records. Clinical access by third parties requires explicit, time-bounded consent via 6-digit OTPs.
2. **Zero PHI Exposure on Query**:
   Provider patient queries reveal only Full Name and DOB, neutralizing potential harvesting of sensitive clinical records.
3. **Automated Session Expiration**:
   Delegated clinical authorizations terminate automatically upon reaching their granted duration (`expiresAt < now`).
4. **Clinical AI Boundaries**:
   Autonomous drug prescribing is prevented by regex interceptors and knowledge checks. Emergency and non-medical queries trigger explicit medical boundary notices.
5. **Tamper-Evident SHA-256 Integrity**:
   Every uploaded medical record has a cryptographic checksum recorded in PostgreSQL to verify document integrity.

---

## 👥 Contributors & Acknowledgements
Developed with ❤️ by **Peak Constructors — Tridibesh Sen** and the **MediLocker Engineering Team**. Designed in adherence to **Ayushman Bharat Digital Mission (ABDM)** principles.

---

## 📄 License
This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.