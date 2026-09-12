import { gcm } from '@noble/ciphers/aes.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { EMPTY_HEALTH_DATA, type HealthData } from '@/lib/health-types';

const DATA_KEY = 'cyclewise.health.v1';
const ENCRYPTION_KEY = 'cyclewise.key.v1';
const WEB_KEY = 'cyclewise.web-key.v1';
const AAD = new TextEncoder().encode('cyclewise.health.v1');

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getOrCreateKey(): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    let stored = await AsyncStorage.getItem(WEB_KEY);
    if (!stored) {
      stored = toBase64(await getRandomBytesAsync(32));
      await AsyncStorage.setItem(WEB_KEY, stored);
    }
    return fromBase64(stored);
  }

  let stored = await SecureStore.getItemAsync(ENCRYPTION_KEY);
  if (!stored) {
    stored = toBase64(await getRandomBytesAsync(32));
    await SecureStore.setItemAsync(ENCRYPTION_KEY, stored, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  return fromBase64(stored);
}

export async function loadHealthData(): Promise<HealthData> {
  const payload = await AsyncStorage.getItem(DATA_KEY);
  if (!payload) return EMPTY_HEALTH_DATA;

  const { nonce, encrypted } = JSON.parse(payload) as { nonce: string; encrypted: string };
  const key = await getOrCreateKey();
  const plaintext = gcm(key, fromBase64(nonce), AAD).decrypt(fromBase64(encrypted));
  return JSON.parse(new TextDecoder().decode(plaintext)) as HealthData;
}

export async function saveHealthData(data: HealthData): Promise<void> {
  const key = await getOrCreateKey();
  const nonce = await getRandomBytesAsync(12);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = gcm(key, nonce, AAD).encrypt(plaintext);
  await AsyncStorage.setItem(
    DATA_KEY,
    JSON.stringify({ nonce: toBase64(nonce), encrypted: toBase64(encrypted) }),
  );
}

export async function deleteStoredHealthData(): Promise<void> {
  await AsyncStorage.multiRemove([DATA_KEY, WEB_KEY]);
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(ENCRYPTION_KEY);
}
