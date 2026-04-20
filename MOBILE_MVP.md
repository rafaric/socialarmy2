# SocialARMY — Mobile MVP (Android)

## Contexto

SocialARMY es una red social para la comunidad ARMY (fans de BTS), construida con Next.js 15 + Supabase. Este documento describe el plan para implementar la app Android nativa como complemento a la interfaz web existente.

**Repo web:** https://github.com/rafaric/socialarmy2  
**Stack web:** Next.js 15, TypeScript, Bun, Supabase, Zustand, React Query v5, Framer Motion, Tailwind CSS v4

---

## Decisiones técnicas

| Decisión | Elección | Razón |
|----------|----------|-------|
| Framework | **Expo SDK (managed workflow)** | Acceso a todas las APIs nativas sin configuración manual de Android |
| Navegación | **Expo Router v3** | File-based routing, igual que Next.js App Router — curva de aprendizaje mínima |
| Estilos | **NativeWind v4** | Tailwind en React Native — coherencia visual con la web |
| Auth/DB | **Supabase JS** (mismo cliente) | Reutilización directa |
| Estado servidor | **React Query v5** (mismos hooks) | Reutilización directa |
| Estado global | **Zustand v5** (mismo store) | Reutilización directa |
| Push notifications | **Expo Notifications + FCM** | Integración nativa con Android |
| Cámara/Galería | **Expo Image Picker** | API simple y completa |
| Share intent | **Intent filter en AndroidManifest** | Recibir URLs desde Facebook, Instagram, Chrome, etc. |
| Build/Deploy | **EAS (Expo Application Services)** | Build en la nube, no requiere Android Studio local |

---

## Estructura del proyecto

Crear un **nuevo repositorio** `socialarmy2-mobile` independiente del repo web. No es un monorepo — la lógica compartida se copia/adapta.

```
socialarmy2-mobile/
├── app/                        # Expo Router — screens
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Tab bar
│   │   ├── index.tsx           # Feed
│   │   ├── search.tsx
│   │   ├── collection.tsx
│   │   ├── notifications.tsx
│   │   └── profile.tsx
│   ├── post/
│   │   └── [id].tsx            # Post detalle
│   ├── share.tsx               # Screen para share intent
│   └── _layout.tsx             # Root layout
├── components/                 # Componentes UI nativos
├── hooks/                      # React Query hooks (copiados/adaptados del web)
├── lib/
│   ├── supabase.ts             # Cliente Supabase
│   ├── constants.ts
│   └── bts-eras.ts             # Copiar de web
├── store/
│   └── useAuthStore.ts         # Copiar de web
├── types/
│   └── index.ts                # Copiar de web
└── assets/
```

---

## Setup inicial (Windows)

### Requisitos
- Node.js 20+ o Bun
- Git
- Android Studio (para emulador) o dispositivo físico con USB debugging

### Pasos

```bash
# 1. Instalar Expo CLI
npm install -g eas-cli expo-cli

# 2. Crear el proyecto
npx create-expo-app socialarmy2-mobile --template blank-typescript
cd socialarmy2-mobile

# 3. Instalar dependencias principales
npx expo install expo-router expo-notifications expo-image-picker
npx expo install @supabase/supabase-js @tanstack/react-query zustand
npx expo install nativewind tailwindcss
npx expo install expo-linking expo-constants expo-status-bar

# 4. Variables de entorno — crear .env.local
EXPO_PUBLIC_SUPABASE_URL=<mismo valor que el web>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<mismo valor que el web>
```

### app.json — configuración clave

```json
{
  "expo": {
    "name": "SocialARMY",
    "slug": "socialarmy",
    "scheme": "socialarmy",
    "android": {
      "package": "com.socialarmy.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [{ "scheme": "socialarmy" }],
          "category": ["BROWSABLE", "DEFAULT"]
        },
        {
          "action": "SEND",
          "category": ["DEFAULT"],
          "data": [{ "mimeType": "text/plain" }]
        }
      ]
    }
  }
}
```

El segundo `intentFilter` (ACTION_SEND) es el que permite recibir URLs compartidas desde otras apps.

---

## Lógica compartida con el web (copiar y adaptar)

Estos archivos se copian del repo web con mínimas modificaciones:

| Archivo web (`src/`) | Destino mobile | Cambios |
|---------------------|----------------|---------|
| `types/index.ts` | `types/index.ts` | Ninguno |
| `lib/bts-eras.ts` | `lib/bts-eras.ts` | Ninguno |
| `lib/bts-members.ts` | `lib/bts-members.ts` | Ninguno |
| `lib/bts-discography.ts` | `lib/bts-discography.ts` | Ninguno |
| `lib/constants.ts` | `lib/constants.ts` | Ninguno |
| `store/useAuthStore.ts` | `store/useAuthStore.ts` | Ninguno |
| `hooks/usePosts.ts` | `hooks/usePosts.ts` | Cambiar import de `@/lib/supabase/browser` a `@/lib/supabase` |
| `hooks/usePostActions.ts` | `hooks/usePostActions.ts` | Igual |
| `hooks/usePacks.ts` | `hooks/usePacks.ts` | Igual |
| `hooks/useNotifications.ts` | `hooks/useNotifications.ts` | Igual |
| `hooks/useProfile.ts` | `hooks/useProfile.ts` | Igual |
| `hooks/useFriends.ts` | `hooks/useFriends.ts` | Igual |

### Cliente Supabase para mobile (`lib/supabase.ts`)

```ts
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

Nota: instalar `@react-native-async-storage/async-storage` para persistencia de sesión.

---

## Feature prioritaria: Share Intent

### El flujo
1. Usuario está en Facebook/Instagram/Chrome
2. Toca "Compartir" → selecciona "SocialARMY"
3. La app se abre en `app/share.tsx`
4. Se llama al mismo endpoint `/api/unfurl` del web
5. Se muestra el PostForm con imagen y texto pre-cargados

### Implementación en `app/share.tsx`

```tsx
import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";

export default function ShareScreen() {
  const params = useLocalSearchParams();
  const sharedUrl = params?.url as string | undefined;

  useEffect(() => {
    if (!sharedUrl) return;
    // Navegar al PostForm con la URL compartida
    router.replace({ pathname: "/(tabs)/", params: { shareUrl: sharedUrl } });
  }, [sharedUrl]);

  return null;
}
```

### Capturar el intent en `_layout.tsx`

```tsx
import * as Linking from "expo-linking";

// En el root layout, escuchar intents entrantes
useEffect(() => {
  const sub = Linking.addEventListener("url", ({ url }) => {
    // url viene como "socialarmy://share?url=https://..."
    const parsed = Linking.parse(url);
    if (parsed.queryParams?.url) {
      router.push({ pathname: "/share", params: { url: parsed.queryParams.url } });
    }
  });
  return () => sub.remove();
}, []);
```

### Llamada a unfurl (mismo endpoint del web)

```ts
const WEB_URL = "https://socialarmy2.vercel.app"; // URL del deploy web

async function unfurlUrl(url: string) {
  const res = await fetch(`${WEB_URL}/api/unfurl?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error("private");
  return res.json();
}
```

---

## MVP — Features scope

### Fase 1 (core)
- [ ] Auth (login / registro con Supabase)
- [ ] Feed (lista de posts, reacciones)
- [ ] Ver post detalle con comentarios
- [ ] Perfil de usuario

### Fase 2 (contenido)
- [ ] Crear post (texto + imagen desde galería/cámara)
- [ ] **Share intent** — recibir URL de otra app y abrir PostForm
- [ ] Comentarios con stickers

### Fase 3 (engagement)
- [ ] Push notifications (FCM via Expo Notifications)
- [ ] Coleccionables — ver colección y abrir sobres
- [ ] Notificación cuando ganás un sobre

### Fuera de scope MVP
- Trading de cartas
- Encuestas
- Now Playing
- Era selector
- Admin panel

---

## Push Notifications (Fase 3)

### Setup FCM
1. Crear proyecto en Firebase Console
2. Agregar app Android con package `com.socialarmy.app`
3. Descargar `google-services.json` → poner en raíz del proyecto
4. En `app.json`:
```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

### Guardar token en Supabase

```ts
import * as Notifications from "expo-notifications";

async function registerPushToken(userId: string) {
  const { data: token } = await Notifications.getExpoPushTokenAsync();
  await supabase
    .from("profiles")
    .update({ push_token: token.data })
    .eq("id", userId);
}
```

Agregar columna en Supabase:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token text;
```

---

## Build y distribución

```bash
# Login en EAS
eas login

# Configurar el proyecto
eas build:configure

# Build para Android (APK para testing)
eas build --platform android --profile preview

# Build para Play Store (AAB)
eas build --platform android --profile production
```

El build corre en la nube de Expo — no se necesita Android Studio instalado para buildear, solo para el emulador.

---

## Contexto del proyecto web (para el agente)

- **Supabase project:** ver `.env.local` en el repo web para las keys
- **Tablas principales:** `profiles`, `posts`, `likes`, `notifications`, `pack_log`, `user_cards`, `cards`, `stickers`
- **Storage buckets:** `photos`, `cards`, `stickers`
- **RLS:** habilitado en todas las tablas — el cliente de Supabase con la anon key funciona correctamente para usuarios autenticados
- **API routes del web reutilizables desde mobile:** `/api/unfurl`, `/api/packs/award`, `/api/packs/open/[id]`, `/api/packs/pending`, `/api/packs/login-streak`
- **Deploy web:** Vercel — URL de producción donde viven las API routes

---

## Notas para el agente en Windows

1. Clonar este repo para entender el modelo de datos y la lógica de negocio
2. Crear `socialarmy2-mobile` como repo nuevo
3. Las API keys de Supabase son las mismas que el web — pedirlas al usuario
4. Para testear el share intent en emulador: `adb shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT "https://www.facebook.com/rollingstone"`
5. NativeWind v4 requiere configuración específica — seguir la doc oficial: https://www.nativewind.dev/v4/getting-started/expo-router
