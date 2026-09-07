import AsyncStorage from '@react-native-async-storage/async-storage';


export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
  }
}

export async function keysWithPrefix(prefix: string): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter(function (key) {
      return key.startsWith(prefix);
    });
  } catch {
    return [];
  }
}

export async function removeByPrefix(prefix: string): Promise<void> {
  try {
    const mine = await keysWithPrefix(prefix);
    if (mine.length > 0) {
      await AsyncStorage.multiRemove(mine);
    }
  } catch {
  }
}
