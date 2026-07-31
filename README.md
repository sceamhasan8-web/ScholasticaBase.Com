# ScholasticBase — Smart School Management Platform

![ScholasticBase Banner](https://img.shields.io/badge/Brand-ScholasticBase-064E3B?style=for-the-badge&logo=education)
![License](https://img.shields.io/badge/License-Proprietary-silver?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Enterprise_Grade-059669?style=for-the-badge)

**ScholasticBase** is an enterprise-grade, multi-tenant Smart School Management Platform built for modern educational institutions, academies, and school networks. It unifies administrative operations, teacher grading workflows, student academic portals, principal approvals, fee management, automated routine generators, and web-to-print engines into an intuitive, responsive system.

---

## 🎨 Visual Identity & Brand Guidelines

- **Brand Name**: ScholasticBase
- **Tagline**: Smart School Management Platform
- **Emblem / Crest**: Metallic Silver Crown & Open Book with Stylized Emerald 'S' Emblem
- **Color Palette**:
  - **Primary Deep Emerald**: `#064E3B` / `#04392B`
  - **Vibrant Accent Emerald**: `#10B981` / `#059669`
  - **Silver Chrome Accents**: `#E2E8F0` / `#94A3B8`
  - **Dark Slate Typography**: `#0F172A` / `#334155`
  - **Pearl Clean Canvas**: `#F8FAFC` / `#FFFFFF`

---

## 🚀 Key Features

### 🏢 Multi-Tenant Administration Hub
- **Branch Management**: Native support for Primary, High School, and College sections.
- **Account Provisioning**: Role-based access control (Admin, Principal, Teacher, Class Teacher, Student, Super Admin).
- **Dynamic School Registry**: Real-time lookup by EIIN (Educational Institute Identification Number) or School ID.

### 👩‍🏫 Teacher & Class Management
- **Gradebook & Tabulation**: Real-time marks entry, automatic GPA calculations (Bangladesh Grading standard & global percentage scales), and automated rank resolution.
- **Class Routine Manager**: Interactive weekly schedule manager with multi-period support and clash prevention.

### 🎓 Student & Parent Portal
- **Academic Dashboard**: Real-time transcripts, attendance logs, and notices.
- **Fee Management System**: Online fee breakdown, payment tracking, receipt generation, and principal approval pipelines.

### 🖨️ Global Print & Paged Media Engine
- Pixel-perfect printable transcripts, report cards, admit cards, student ID cards, and official certificates using web-to-print CSS `@media print` standards.

### 📱 Progressive Web App (PWA)
- Installable on iOS, Android, macOS, and Windows with offline persistence and responsive layout adapters.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, React Router DOM
- **Styling**: Vanilla CSS Design Tokens, Tailwind CSS, Responsive Flexbox & Grid Systems
- **Backend & Database**: Firebase Firestore, Firebase Authentication, Firebase Storage
- **Localization**: Multi-language support (English `en`, Bengali `bn`)

---

## 💻 Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/scholasticbase/scholasticbase-platform.git
   cd scholasticbase-platform
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Build for production deployment:
   ```bash
   npm run build
   ```

---

## 📜 License

Copyright © 2026 ScholasticBase. All rights reserved.
