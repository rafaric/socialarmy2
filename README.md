# ARMY Social Network

Red social full-stack para la comunidad ARMY, construida con Next.js 15 App Router, TypeScript y Supabase.

## Features

### Social
- **Feed social** — posts con fotos, etiquetado de amigos, eras y miembros de BTS
- **Reacciones** — 10 emojis animados con Framer Motion (💜🔥✨😭🥹🌟🫶🎵🤯👑)
- **Comentarios con stickers** — sistema de stickers subidos por los propios usuarios
- **Encuestas** — polls en posts con notificaciones al creador y votantes
- **Compartir links externos** — pegás una URL de Facebook, Instagram o cualquier noticia y se extrae automáticamente el contenido (título, descripción, imagen) via OG tags, publicándose como post normal con badge "Vía fuente · dominio"

### Coleccionables
- **Fotocards por eras** — sistema de cartas BTS con rareza (Common / Rare / Epic / Legendary)
- **Sobres por actividad** — se ganan automáticamente al postear, comentar, reaccionar y mantener racha de login
- **Cap diario** — máximo 5 sobres simples por día para evitar farming
- **Modal de onboarding** — explicación del sistema la primera vez que accedés a Colección

### Notificaciones
- **Tiempo real** — via Supabase Realtime
- **Push notifications** — integración con Expo Push para la app mobile
- **Marcar todas como leídas** — botón explícito en la página de notificaciones

### Privacidad y seguridad
- **Bloqueo de usuarios** — bloqueá a alguien para que desaparezca de tu feed, búsqueda y perfil; se cancela la amistad automáticamente
- **Perfil privado** — solo amigos pueden ver tus publicaciones
- **Visibilidad en búsqueda** — toggle para no aparecer en los resultados de búsqueda

### UI / UX
- **Temas por era** — glassmorphism con paleta de colores según era discográfica (Army, Arirang, Butter, MOTS:7)
- **Selector de tema en mobile** — accesible desde tu perfil → Cuenta
- **Scroll al top** — tocar el botón activo de la navbar sube suavemente al inicio
- **Eventos** — calendario del Arirang World Tour con countdown en tiempo real
- **PWA** — instalable en móvil como app nativa

### Admin Dashboard
Panel separado (`bts-admin-dashboard`) con:
- Estadísticas de coleccionables (sobres, rarezas, actividad reciente)
- Catálogo CRUD de cartas
- Regalar sobres a usuarios

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| Lenguaje | TypeScript |
| Runtime | Bun |
| Base de datos | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| State | Zustand v5 + React Query v5 |
| Animaciones | Framer Motion |
| Estilos | Tailwind CSS v4 |
| Deploy | Vercel |

## Desarrollo local

```bash
bun install
bun run dev
```

Requiere un archivo `.env.local` con:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Estructura

```
src/
├── app/
│   ├── (auth)/         # Login / registro
│   ├── (main)/         # Feed, perfil, colección, eventos, búsqueda
│   └── api/            # API routes (packs, unfurl, blocks, notifications)
├── components/         # Componentes UI
├── hooks/              # React Query hooks
├── lib/                # Supabase clients, constantes, utilidades
├── store/              # Zustand stores
└── types/              # TypeScript types
```

## Coleccionables

El sistema de fotocards funciona con sobres que se ganan por actividad:

| Actividad | Sobre | Límite |
|-----------|-------|--------|
| Publicar un post | Super (3 cartas) | Sin límite |
| 5 días seguidos de login | Super (3 cartas) | Sin límite |
| Dar like | Simple (1 carta) | 5 por día |
| Comentar | Simple (1 carta) | 5 por día |

Rarezas: **Common** (55%) · **Rare** (28%) · **Epic** (14%) · **Legendary** (3%)
