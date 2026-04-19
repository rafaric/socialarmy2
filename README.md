# ARMY Social Network

Red social full-stack para la comunidad ARMY, construida con Next.js 15 App Router, TypeScript y Supabase.

## Features

- **Feed social** — posts con fotos, videos, etiquetado de amigos, eras y miembros de BTS
- **Reacciones** — 10 emojis animados con Framer Motion (💜🔥✨😭🥹🌟🫶🎵🤯👑)
- **Stickers globales** — sistema de stickers en comentarios, subida por usuarios
- **Encuestas** — polls en posts con notificaciones al creador y votantes
- **Coleccionables** — sistema de fotocards por eras, sobres ganados por actividad, rareza y trading
- **Eventos** — calendario del Arirang World Tour con countdown en tiempo real
- **Notificaciones** — en tiempo real via Supabase Realtime
- **Temas por era** — glassmorphism con paleta de colores según era discográfica activa
- **PWA** — instalable en móvil

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
│   ├── (main)/         # Feed, perfil, colección, eventos
│   └── api/            # API routes (polls, packs, cron)
├── components/         # Componentes UI
├── hooks/              # React Query hooks
├── lib/                # Supabase clients, constantes, utilidades
├── store/              # Zustand stores
└── types/              # TypeScript types
```

## Coleccionables

El sistema de fotocards funciona con sobres que se ganan por actividad:

| Actividad | Sobre |
|-----------|-------|
| Publicar un post | Super (3 cartas) |
| 5 días seguidos de login | Super (3 cartas) |
| Dar like | Simple (1 carta) |
| Comentar | Simple (1 carta) |

Rarezas: **Common** (55%) · **Rare** (28%) · **Epic** (14%) · **Legendary** (3%)
