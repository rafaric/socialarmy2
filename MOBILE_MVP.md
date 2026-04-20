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

## Design Tokens — respetar al pie de la letra

El objetivo es que un usuario que use web y mobile reconozca inmediatamente que es la misma app. No improvisar colores ni radios.

### Cómo usar en NativeWind / StyleSheet

Definir un archivo `lib/theme.ts` con todos los tokens y usarlo en toda la app:

```ts
// lib/theme.ts
export const theme = {
  colors: { /* ver abajo */ },
  radius: { /* ver abajo */ },
  shadow: { /* ver abajo */ },
} as const;
```

---

### Colores — tema default (púrpura ARMY)

```ts
colors: {
  // Fondos
  bgDeep:        "#070b16",   // fondo más oscuro — body/screen background
  bgSurface:     "#0d1526",   // superficie de cards

  // Glassmorphism
  glassBg:       "rgba(13, 21, 38, 0.6)",
  glassBorder:   "rgba(124, 77, 206, 0.25)",

  // Accent
  accent:        "#7c4dce",
  accentHover:   "#9b6fe8",
  accentGlow:    "rgba(124, 77, 206, 0.45)",
  accentGold:    "#c9a84c",
  accentGoldGlow:"rgba(201, 168, 76, 0.35)",

  // Texto
  textPrimary:   "#f0eeff",
  textSecondary: "#9d8fcb",
  textMuted:     "#8878c0",

  // Aurora (gradiente de fondo animado)
  aurora1:       "#0d1526",
  aurora2:       "#130d2e",
  aurora3:       "#0a1a1f",
  aurora4:       "#1a0d26",
}
```

### Colores — tema Arirang (rojo, era 2026 — tema activo ahora)

```ts
colors: {
  bgDeep:        "#120808",
  bgSurface:     "#1e0e0e",
  glassBg:       "rgba(30, 14, 14, 0.65)",
  glassBorder:   "rgba(204, 41, 54, 0.25)",
  accent:        "#cc2936",
  accentHover:   "#e53935",
  accentGlow:    "rgba(204, 41, 54, 0.45)",
  accentGold:    "#c9a84c",
  textPrimary:   "#fff0f0",
  textSecondary: "#c98a8a",
  textMuted:     "#c06868",
}
```

### Colores — rarezas de cartas (usar en colección y PackOpener)

```ts
rarity: {
  common:    { color: "#9ca3af", glow: "rgba(156,163,175,0.4)" },
  rare:      { color: "#60a5fa", glow: "rgba(96,165,250,0.5)"  },
  epic:      { color: "#a855f7", glow: "rgba(168,85,247,0.6)"  },
  legendary: { color: "#f59e0b", glow: "rgba(245,158,11,0.7)"  },
}
```

### Colores — eras de BTS

```ts
eras: {
  "2cool4skool": { color: "#e8b86d", bg: "rgba(232,184,109,0.15)" },
  hyyh:          { color: "#ff8c69", bg: "rgba(255,140,105,0.15)" },
  wings:         { color: "#9b6fe8", bg: "rgba(155,111,232,0.15)" },
  love_yourself: { color: "#f06292", bg: "rgba(240,98,146,0.15)"  },
  mots:          { color: "#4fc3f7", bg: "rgba(79,195,247,0.15)"  },
  be:            { color: "#a5d6a7", bg: "rgba(165,214,167,0.15)" },
  butter:        { color: "#f9d342", bg: "rgba(249,211,66,0.15)"  },
  proof:         { color: "#c9a84c", bg: "rgba(201,168,76,0.15)"  },
  arirang:       { color: "#cc2936", bg: "rgba(204,41,54,0.15)"   },
}
```

### Colores — miembros BTS (para etiquetas y barras)

```ts
members: {
  rm:       "#9b6fe8",
  jin:      "#f06292",
  suga:     "#4fc3f7",
  jhope:    "#fbbf24",
  jimin:    "#f472b6",
  v:        "#34d399",
  jungkook: "#60a5fa",
}
```

---

### Espaciado y radios

```ts
radius: {
  card: 16,    // --radius-card: 1rem
  button: 8,   // botones estándar
  input: 8,    // inputs
  full: 9999,  // pills / badges
}

spacing: {
  // Usar los defaults de NativeWind (misma escala que Tailwind)
  // p-4 = 16px, p-5 = 20px, p-6 = 24px, gap-3 = 12px, gap-4 = 16px
}
```

---

### Sombras

```ts
shadows: {
  card:      "0 4px 32px rgba(124, 77, 206, 0.15)",
  cardHover: "0 8px 48px rgba(124, 77, 206, 0.3)",
  // En React Native usar elevation + shadowColor:
  cardRN: {
    shadowColor: "#7c4dce",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  }
}
```

---

### Glass card — equivalente en React Native

El glassmorphism requiere `expo-blur`. Instalar con `npx expo install expo-blur`.

```tsx
import { BlurView } from "expo-blur";

// Equivalente al .glass-card del web
function GlassCard({ children, style }) {
  return (
    <BlurView
      intensity={60}
      tint="dark"
      style={[{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(124, 77, 206, 0.25)",
        overflow: "hidden",
        shadowColor: "#7c4dce",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
      }, style]}
    >
      {children}
    </BlurView>
  );
}
```

---

### Botón accent — equivalente en React Native

```tsx
// Equivalente al .btn-accent del web
function AccentButton({ onPress, children, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: pressed ? "#9b6fe8" : "#7c4dce",
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 20,
        shadowColor: "#7c4dce",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: pressed ? 0.6 : 0.45,
        shadowRadius: pressed ? 16 : 8,
        elevation: pressed ? 6 : 4,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
        {children}
      </Text>
    </Pressable>
  );
}
```

---

### Fondo aurora — equivalente en React Native

En web es un CSS gradient animado. En mobile usar un gradiente estático con `expo-linear-gradient` como aproximación:

```tsx
import { LinearGradient } from "expo-linear-gradient";

// En el root layout, detrás de todo el contenido
function AuroraBg() {
  return (
    <LinearGradient
      colors={["#0d1526", "#130d2e", "#0a1a1f", "#070b16"]}
      locations={[0, 0.3, 0.7, 1]}
      start={{ x: 0.2, y: 0.1 }}
      end={{ x: 0.8, y: 0.9 }}
      style={StyleSheet.absoluteFillObject}
    />
  );
}
```

---

### Tipografía

La fuente especial `Monoton` se usa solo en el logo "ARMY". El resto es sistema.

```ts
fonts: {
  // Logo ARMY — cargar con expo-font
  // Descargar Monoton de Google Fonts e incluir en assets/fonts/
  logo: "Monoton",

  // Resto de la UI — fuente del sistema
  regular: undefined,   // Platform default
  medium:  undefined,
  bold:    undefined,

  // Tamaños equivalentes a las clases Tailwind usadas en el web
  sizes: {
    xs:   10,   // text-xs
    sm:   12,   // text-sm
    base: 14,   // text-base (base en mobile)
    lg:   16,   // text-lg
    xl:   18,   // text-xl
    "2xl": 22,  // text-2xl
  }
}
```

---

## Notas para el agente en Windows

1. Clonar este repo para entender el modelo de datos y la lógica de negocio
2. Crear `socialarmy2-mobile` como repo nuevo
3. Las API keys de Supabase son las mismas que el web — pedirlas al usuario
4. Para testear el share intent en emulador: `adb shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT "https://www.facebook.com/rollingstone"`
5. NativeWind v4 requiere configuración específica — seguir la doc oficial: https://www.nativewind.dev/v4/getting-started/expo-router
