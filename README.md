<div align="center">
  <img src="logos/logo.png" width="120" alt="The 75 Project Logo" />
</div>

# The 75 Project

An offline-first, regulation-aware attendance tracker for JNTUH students. This app ensures you never accidentally drop below the mandatory 75% attendance threshold by providing mathematically precise safe-to-skip margins and worst-case burndown dates.

---

## 🚀 Features

- **Offline-First Architecture**: Built on a local SQLite database. The app works flawlessly without the internet.
- **Background Sync Engine**: Utilizes an Outbox Pattern to automatically sync local changes to Supabase in the background when connectivity is restored.
- **Guest Mode Persistence**: Start using the app instantly without signing up. Your data is stored locally and can be seamlessly migrated to a cloud account later.
- **Smart Regulation Engine**: Automatically applies the correct attendance rules based on your program (B.Tech, M.Tech, IDP) and year (Aggregate vs. Per-Subject).
- **AI Timetable Extraction**: Just upload a photo of your schedule. The integrated FastAPI backend uses NVIDIA NIM (Nemotron Vision) to instantly digitize it.
- **Rich Insights**: Visual progress rings, a calendar heatmap, and a "Worst-Case Burndown" predictor.
- **Risk-Aware Theming**: Red is strictly reserved for genuine danger ($<75\%$). Supports dynamic Light & Dark modes.
- **Crowd-Sourced Exceptions**: Share class groups and crowdsource timetable cancellations and swaps via a dynamic quorum system.

---

## 🛠️ Tech Stack

### Frontend (Mobile App)
- **Framework**: React Native (Expo SDK 57)
- **Routing**: Expo Router (File-based)
- **Local DB**: `expo-sqlite`
- **Styling**: Custom Token-based Theme System
- **Notifications**: `expo-notifications` (Local scheduling)

### Cloud & Auth
- **Backend as a Service**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Email + Password)
- **Security**: Strict Row Level Security (RLS) on all tables

### AI Backend (`/backend`)
- **Framework**: FastAPI (Python 3.11)
- **Deployment**: Render
- **Models**: NVIDIA NIM (Nemotron Vision)

---

## 💻 Local Setup

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_API_URL=http://localhost:8000
   ```

3. **Start the Metro Bundler:**
   ```bash
   npx expo start
   ```

*(Note: If you run into Metro connection issues on a physical device, try running `adb reverse tcp:8081 tcp:8081` for USB, or `npx expo start --tunnel` for Wi-Fi.)*

### Backend Setup (FastAPI)

1. **Navigate to the backend directory and set up a virtual environment:**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Backend Environment Variables:**
   Create a `.env` file in the `backend` directory:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key
   NIM_API_KEY=your_nvidia_nim_api_key
   ```

4. **Start the FastAPI server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

---

## 📝 Recent Implementation History

The app was successfully built out in 7 distinct phases based on the v3.1 SRS:

1. **Infrastructure**: Initialized Expo, SQLite, and Supabase RLS policies.
2. **Core Engine**: Implemented the pure math calculation engine, dual-write outbox sync, and Guest-to-Account migration logic.
3. **Onboarding**: Built the Welcome, Auth, Profile Setup, and Timetable upload screens.
4. **Daily Use**: Built the chronological "Today" period cards, History logs, and the generalized Crowd Claims override system.
5. **Insights**: Built the `ThresholdRing`, `CalendarHeatmap`, `BurndownCard`, and Evidence Log screens.
6. **Backend**: Implemented the FastAPI LLM proxy for timetable parsing and condonation letter generation.
7. **Full Integration (Phase 7)**: 
   - Wired the "Today" screen to read dynamically from local SQLite.
   - Wired the AI Timetable extraction to use `expo-image-picker` and successfully POST to the FastAPI backend, parse the JSON, and persist to the local `timetable_slots` tables.
   - Connected the Insights screen to read real historical attendance logs using pure functions from `engine.ts`.
   - Wired up exception overrides (`addDaySwapOverride`, `addExtraClass`) and enforced Atomic Transactions for marking attendance.

8. **Advanced UX & Crowd Features (Phase 8)**:
   - Built out the FastAPI backend to support Crowd-Sourced Class Groups (FR-4.3 & FR-7) with share codes and 50% quorum logic.
   - Wired up the `class-groups.tsx` frontend to seamlessly join groups and submit crowd reports.
   - Integrated Local Notifications (`expo-notifications`) for daily evening reminders.
   - Built a Retroactive Fill-In Prompt (FR-3.7) to catch up on 10 days of missed attendance.
   - Implemented a 3-second Undo Toast (FR-3.5) for quick corrections on the Today screen.
   - Added Share-Code Timetable Cloning (FR-2.8) to the Timetable setup flow.

9. **Final Polish & Deployment (Phase 9)**:
   - Deployed FastAPI backend to Render.
   - Fully wired native AI Timetable extraction (`expo-file-system/legacy` -> FastAPI -> NVIDIA NIM Vision).
   - Integrated Guest Mode Sign-In directly on the Settings screen for frictionless upgrades.
   - Polished the Dashboard with `react-native-reanimated` transitions and `expo-linear-gradient`.
   - Built a dynamic Calendar Heatmap (FR-5.6) component inside the Insights screen.
   - Added an Extra Class FAB (FR-4.4) on the Today screen.

**Bug Fixes & Polish:**
- Cleaned up default Expo template boilerplate to resolve TypeScript compilation errors (`npx tsc --noEmit` now passes cleanly).
- Fixed an infinite loading screen bug by introducing the `'unauthenticated'` state to `AuthContext`, allowing the app to smoothly transition from the splash screen to the Welcome Screen.
- Replaced the placeholder logo text with a natively rendered `react-native-svg` conversion of `logo.svg`.
- Resolved type mismatches with `NotificationBehavior` and `OpaqueColorValue`.
- Fixed UUID typing issues during Timetable Import.
- Fixed `expo-notifications` crash on Android Expo Go via safe dynamic import.
- Built intelligent Subject mapping and Day/Period uniqueness validation into the Manual Slot Add feature.

---

---

## 🚀 Things to Be Done (TODO)

While the core functionality of The 75 Project is complete and live, there are a few deferred features and final integrations planned for the next major release:

- [ ] **Extra Class Persistence**: The Extra Class FAB on the Dashboard has been visually polished but needs to be fully wired to the local SQLite `addExtraClass` transaction.
- [ ] **Crowd-Source Quorum Testing**: The backend logic for 50% quorum consensus (FR-7) is built in FastAPI, but rigorous real-device testing with multiple users joining the same class group is required to ensure race conditions don't occur.
- [ ] **Push Notifications**: Local device notifications are active, but true Remote Push Notifications via Expo's Push service need to be set up to notify users immediately when a crowd-sourced class is cancelled.
- [ ] **Evidence Log & Condonation Letters (FR-8)**: UI is mocked, but needs to be fully built out to allow users to upload medical certificates and generate formatted PDF condonation letters.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
