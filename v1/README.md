# The 75 Project

The 75 Project is a beautifully designed, mobile-first attendance tracker built specifically for JNTUH students to effortlessly maintain their 75% attendance requirement.

## Features

- **Smart JSON Timetable Import:** Extract your class schedule from an image via an LLM, output it as JSON, and paste it directly into the app for instant setup.
- **Dynamic Calculation Modes:** Choose between checking your overall aggregate attendance or a granular per-subject breakdown.
- **Unlimited Exam Phases:** Create multiple exam periods (Midterms, Finals) where attendance is automatically paused so you can focus entirely on your studies.
- **Advanced Subject Management:** A dedicated screen to view live stats for every subject and manually tweak held/attended counts to fix real-world discrepancies (like cancelled classes).
- **Safe-to-Skip Recommendations:** Immediately see how many classes you can afford to miss without dropping below the 75% threshold, or exactly how many you must attend to catch up.
- **Beautiful Dark Theme:** A premium, modern dark mode design with sleek typography and subtle haptic feedback for a great user experience.

## Running the App Locally

To start the development server:

```bash
npm start
```
Scan the QR code with the Expo Go app on your phone.

## Production Build

This app is configured for Expo Application Services (EAS) cloud builds. 

To generate a production APK for Android:
```bash
eas build --platform android --profile production
```

To generate a production IPA for iOS (requires Apple Developer account):
```bash
eas build --platform ios --profile production
```

## License

This project is open-source and available under the MIT License.

## Tech Stack
- Expo / React Native
- Expo SQLite (Local Database)
- Expo Router
- Vanilla React Native Styles (No Tailwind)
