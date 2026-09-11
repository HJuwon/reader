import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hj.reader",
  appName: "reader",
  webDir: "public",
  server: {
    url: "https://reader-delta-ten.vercel.app",
    cleartext: false,
  },
};

export default config;