import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { getBaseUrl } from "../services/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  registerForPushNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") {
    console.log("Push notifications skipped on web");
    return null;
  }

  let token: string | null = null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1E40AF",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Permission not granted for push notifications");
      return null;
    }

    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        console.log("❌ EAS projectId missing");
        return null;
      }

      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

      console.log("✅ Expo push token:", token);
    } catch (error) {
      console.log("❌ Error getting push token:", error);
    }
  } else {
    console.log("❌ Must use physical device for Push Notifications");
  }

  return token;
}

async function sendTokenToServer(token: string): Promise<void> {
  try {
    const url = `${getBaseUrl()}/api/register-push-token`;
    console.log("[Push] Registering token to:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const text = await response.text(); // da vidiš šta backend vraća
    if (response.ok) {
      console.log("✅ Push token registered with server:", text);
    } else {
      console.log("❌ register-push-token failed:", response.status, text);
    }
  } catch (error: any) {
    console.log(
      "❌ Failed to register push token with server:",
      error?.message || error,
    );
  }
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const registerForPushNotifications = async () => {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      setExpoPushToken(token);
      await sendTokenToServer(token);
    }
  };

  useEffect(() => {
    registerForPushNotifications();

    notificationListener.current =
      Notifications.addNotificationReceivedListener(
        (n: Notifications.Notification) => {
          setNotification(n);
        },
      );

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        (r: Notifications.NotificationResponse) => {
          console.log("Notification response:", r);
        },
      );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{ expoPushToken, notification, registerForPushNotifications }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotification must be used within a NotificationProvider",
    );
  }
  return context;
}
