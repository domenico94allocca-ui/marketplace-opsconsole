# BacoliOnLife — Marketplace digitale locale

## Cos'è
Marketplace digitale per la città di Bacoli: un'unica vetrina che mette in contatto **clienti locali**, **negozianti** (partner) e **amministrazione**. Combina e-commerce multi-vendor, sistema fedeltà a punti, promozioni, premi e cassa offline con QR.

## Target
| Persona | Cosa fa |
|---|---|
| **Cliente** | Esplora negozi, sfoglia volantino/offerte, mette nel carrello prodotti di vendor diversi, paga con un solo checkout, accumula punti, riscatta premi, gira la ruota della fortuna |
| **Partner (negoziante)** | Si registra in 2 step, gestisce il proprio negozio e prodotti, accetta ordini, redime offline le promozioni con QR/PIN, gestisce la cassa |
| **Admin** | Configura categorie, ruota fortuna, premi, package punti, validazione promozioni, audit redeem, system settings |

## Differenziatori
- **Hyperlocal**: solo Bacoli, focus identità locale
- **Multi-vendor con UX unificata**: il cliente vede un unico marketplace, dietro ci sono N negozi
- **Sistema punti integrato**: ogni acquisto/azione → punti → premi, lotti con scadenza
- **Promozioni redimibili offline**: PIN cassa + QR per scenari senza connessione
- **App mobile** Flutter (iOS) oltre al web

## Pubblico
- Cittadini di Bacoli e zone limitrofe
- Negozianti del territorio
- Eventi/iniziative locali integrabili nel sistema premi

## Stack tecnico in breve
- Backend: Node.js + Express + Prisma + Postgres + Redis
- Frontend web: Next.js (App Router) + Tailwind
- Mobile: Flutter (iOS principalmente)
- Infra: Docker, Hetzner, Nginx Proxy Manager
- Vedi `marketplace/docker-compose.server.yml`

## Versione corrente
La vede la dashboard OpsConsole (`/api/health` del marketplace + tag GitHub).
