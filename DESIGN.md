# Design — Ośmiornica

Dwa motywy do wyboru per urządzenie (`/settings`, klucz localStorage `dart_theme`).
Oba dzielą układ i komponenty; różnią się tokenami i kilkoma elementami oznaczonymi wariantem `drog:`.

## Motywy

| | Odświeżony (domyślny) | Drogowskaz |
|---|---|---|
| Scena | ciemny, wieczór / słabe światło | jasny, dzień |
| Tło / karta | `#0b0d10` / `#13171b` | `#f4f4f2` / `#ffffff` |
| Tekst / wyciszony | `#eceef0` / `#8b929a` | `#0b0b0b` / `#555555` |
| Akcent (wypełnienie) | zielony `#34e39a` | żółty znak `#ffcc00` |
| Akcent jako tekst (`-ink`) | ten sam zielony | czarny `#0b0b0b` |
| Krój | Geist + Geist Mono (cyfry) | Asap (cyfry pogrubione, tabelaryczne) |
| Narożniki | domyślne Tailwinda | 3–6 px (oznakowanie) |
| Głębia | cień z przesunięciem `--shadow-raised` | brak cieni, linie 1 px |

## Tokeny (src/app/globals.css)

Wartości w `:root` i `[data-theme="drogowskaz"]`, mapowane w `@theme inline` na zmienne,
więc utility przełączają się w runtime.

- Powierzchnie: `background`, `foreground`, `card`, `card-hover`, `surface`, `surface-light`,
  `border`, `border-bright`, `muted`.
- Role kolorów: `accent`, `danger`, `warn`, `info`, `extra`. Każda ma trzy warianty:
  - bazowy (`bg-accent`) = wypełnienie,
  - `-ink` (`text-accent-ink`, `border-accent-ink`) = tekst/obramowanie na tle,
  - `on-` (`text-on-accent`) = tekst na wypełnieniu.
  Zasada: **`text-`/`border-` zawsze z `-ink`**, `bg-` bez. Inaczej żółty tekst na jasnym tle.
- Przezroczystości bieli zapisujemy jako `foreground/N` (nie `white/N`), żeby działały w obu motywach.
- Klasy `glass`, `glow-*`, `pulse-active`, `player-inactive` są zdefiniowane w CSS przez tokeny:
  karta = pełna powierzchnia + linia 1 px, bez rozmycia i poświaty.

## Wariant `drog:`

`@custom-variant drog` — klasy działające tylko w Drogowskazie (np. `drog:bg-accent`,
`hidden drog:flex`). Elementy specyficzne dla Drogowskazu renderują się zawsze i są
ukrywane/pokazywane CSS-em (brak różnic SSR ↔ klient).

## Ekran meczu

Rzucający = karta główna (reszta 88–104 px), pod nią pozostali w kolejności rzutów.
Drogowskaz: karta główna jako żółty pas na całą szerokość, czarny pas „Droga do zamknięcia”
z żółtymi polami i strzałkami, znacznik „NASTĘPNY”. Odświeżony: zamknięcie w karcie głównej,
„następny” jako tekst przy graczu.

## Świadome wyjątki

- Heatmapa tarczy (`DartboardHeatmap`) zostaje ciemną płytą w obu motywach.
- Kolory graczy (`PLAYER_COLORS`) to pełne wypełnienia z białym inicjałem.
- Medale (złoto/srebro/brąz) mają ciemniejsze odcienie tekstu w Drogowskazie (`drog:text-amber-*`).
