# BacoliOnLife — Funzioni chiave

## Per i clienti
| Funzione | Pagine web | API backend | Modello DB |
|---|---|---|---|
| Account & profilo | `/registrati`, `/accedi`, `/profilo` | `/api/auth` | `User` |
| Catalogo negozi | `/negozi`, `/negozi/[slug]` | `/api/shops`, `/api/categories`, `/api/shop-custom-categories` | `Shop`, `ShopCategory`, `ShopCustomCategory` |
| Catalogo prodotti | `/prodotti`, `/prodotti/[shopSlug]/[productSlug]` | `/api/products` | `Product`, `ProductCategory` |
| Carrello multi-vendor | `/carrello` | `/api/cart` | `Cart`, `CartItem` |
| Checkout | `/checkout` | `/api/checkout` | `Order`, `OrderItem`, `MockOrder` |
| Ordini | `/ordini`, `/ordini/[id]` | `/api/orders` | `Order`, `OrderItem` |
| Promozioni & volantino | `/offerte`, `/volantino` | `/api/promotions` | `Promotion` |
| Sistema punti | `/profilo` (saldo) | `/api/points` | `PointBalance`, `PointLot`, `PointTransaction`, `PointPurchase`, `PointPackage` |
| Premi (riscatto) | `/premi` | `/api/prizes` | `Prize`, `PrizeRedemption` |
| Ruota della fortuna | (popup cliente) | `/api/wheel` | `WheelSegment`, `WheelSpin` |

## Per i partner (negozianti)
| Funzione | Pagine web | API backend |
|---|---|---|
| Registrazione 2 step | `/partner/registrati`, `/partner/accedi` | `/api/auth` (ruolo partner) |
| Dashboard negozio | `/partner/dashboard` | `/api/shops`, `/api/products` |
| Cassa offline | `/partner/cassa` | `/api/admin` (assign-offline, redeem QR/PIN) |

## Per l'amministrazione
| Funzione | Pagine web | API backend |
|---|---|---|
| Pannello admin | `/admin` | `/api/admin` |
| Gestione punti & package | `/admin` | `/api/admin/point-packages`, `/api/admin/purchases`, `/api/admin/transactions` |
| Settings, audit, scadenze | `/admin` | `/api/admin/settings`, `/api/admin/points/expire`, `/api/admin/redeem-audit` |
| Upload immagini | (dentro le form) | `/api/upload` |

## App mobile (Flutter)
- Customer shell: catalogo, carrello, ordini, profilo, prodotti
- Shopkeeper shell: gestione negozio e ordini
- Auth: condivisa con backend
- Saldo punti coerente con il web (auth response include `pointsBalance`)

## Job & integrazioni
- Cron `expirePointsCron` (scadenza lotti punti)
- Health check Docker per backend/postgres/redis
- Backup automatico DB+volumi+config (daily/weekly/monthly/pre-deploy)

## Sicurezza
- Helmet, CORS configurato per `FRONTEND_URL`
- Rate limit su `/api/auth/login` e `/api/auth/register`
- JWT 7gg di default (`JWT_EXPIRES_IN`)
- Audit log su redeem promozioni e operazioni admin sensibili
