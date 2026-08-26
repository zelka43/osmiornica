@AGENTS.md

# Ośmiornica — dart-scorer

Aplikacja PWA do liczenia punktów w rzutkach (501/301), używana na telefonie podczas gry.
Język UI: **polski**. Repo: `github.com/zelka43/osmiornica`, push do `main` = deploy (Vercel).

## Komendy

```bash
npm run dev     # serwer dev
npm run build   # build + typecheck (obowiązkowo przed commitem)
npm run lint    # eslint (musi być 0 errors; warnings istniejące: img, unused vars)
```

## Stack

Next.js 16 (App Router, klient jako `"use client"`) · React 19 · TypeScript · Tailwind CSS 4
· Framer Motion · Supabase (Postgres + Storage + Realtime). **Uwaga: to nowszy Next.js niż
w danych treningowych — patrz ostrzeżenie w AGENTS.md i docs w `node_modules/next/dist/docs/`.**

## Struktura

```
src/app/
  page.tsx                  dashboard (aktywny mecz, szybkie staty, ostatnie mecze;
                            5 tapnięć w tytuł → /dev)
  match/new/                wybór trybu + ranked/ friendly
  match/[id]/page.tsx       RDZEŃ: liczenie meczu (~1500 linii) — wszystkie tryby
  match/history/            historia meczów standardowych (+ szczegóły /history/[id])
  players/, players/manage/ karty graczy, awatary (Supabase Storage)
  stats/, stats/h2h/        statystyki standardowe, osiągnięcia, medale, H2H
  tournament/, tournament/[id]  drabinka pucharowa 3–8 graczy
  duel/                     pojedynki 1v1
  training/*                5 trybów treningowych (checkout/single/double/triple/punkty)
  dev/page.tsx              panel admina (hasło "dart2024" w kodzie — tylko kosmetyka)
src/lib/
  store.ts                  JEDYNA warstwa dostępu do Supabase (CRUD + mapowanie pól)
  dartLogic.ts              zasady 501/301: bust (<0, ==1, 0 bez double-out), validDarts
  checkouts.ts              tabela zakończeń 2–170
  statsCalculator.ts        statystyki, RTG, medale, osiągnięcia, tabela turniejowa
  tournament.ts             generowanie drabinki, applyLegResult, isPlayable
  duel.ts                   grupowanie serii pojedynków, tabela pojedynków
  voice.ts                  zapowiedzi głosowe (Web Speech API, pl/en)
src/types/index.ts          Player, Match, Turn, Dart, Tournament, TournamentMatch…
```

## Baza danych (Supabase)

Tabele: `players`, `matches` (JSONB `scores`, `turns`), `tournaments` (drabinka w JSONB
`bracket`), `h2h_records`, `app_state` (klucz-wartość: aktywny mecz, ranking_mode).
Kolumny dodane migracjami: `matches.tournament_id`, `matches.duel_id`,
`matches.legs_target`, `matches.bull_winner`.

**Setup/migracje:** uruchamia się je RĘCZNIE w Supabase SQL Editor:
`supabase-schema.sql` (pełny setup), `supabase-migration-avatars.sql`,
`supabase-migration-duels.sql`. Po każdym DDL trzeba odświeżyć cache PostgREST:
`NOTIFY pgrst, 'reload schema';` — inaczej API "nie widzi" nowych tabel/kolumn
(błąd "not in the schema cache", a aplikacja milcząco pokazuje puste listy).

RLS: polityki `FOR ALL USING (true)` + anon key (`NEXT_PUBLIC_*` jest publiczny z natury).
Świadomy brak auth — aplikacja prywatna; każdy z URL-em bazy może modyfikować dane.

## Tryby meczu i ZASADA ZAMKNIĘTYCH TRYBÓW

`MatchType`: `ranked` | `friendly` | `tournament` | `duel`.

- **Tylko `ranked` zasila** statystyki graczy, H2H, medale, osiągnięcia, ranking.
- Turnieje i pojedynki są **w pełni zamknięte**: mają własne tabele agregujące
  (`computeTournamentTable`, `computeDuelTable`) i nie mogą przeciekać do standardu.

Przy DOWOLNYM nowym obliczeniu z meczów filtruj:
`(m.matchType ?? "ranked") === "ranked"` (helper `rankOnly()` w statsCalculator).
Turniejowe/duel legi mają `matchType !== "ranked"` — stary kod bez filtra to bug.

## Seria legów (turnieje i pojedynki)

- Każdy leg = osobny wiersz `matches`. Seria łączy je przez `tournament_id`
  (węzeł drabinki trzyma `legMatchIds`) lub `duel_id`.
- Po checkoutcie `afterCheckout → chainOrFinishSeriesLeg`: jeśli nikt nie osiągnął
  celu (`legsToWin`/`legsTarget`), tworzony jest kolejny leg i `router.replace` —
  gracze zostają w jednym widoku meczu do rozstrzygnięcia.
- **Rzut na bulla** tylko przed 1. legiem; zwycięzca startuje, kolejne legi
  naprzemiennie (`starterIdx = legNumber%2===1 ? bullIdx : 1-bullIdx`).
  Zapis bulla: turniej → `bracket[node].bullWinnerId`; pojedynek → `matches.bull_winner`.
- Pasek górny meczu serii: `Leg N · X–Y · do T` (state `legInfo`).
- Porzucony mecz otwarty w `/match/[id]` **automatycznie wraca do active**
  (obsłużone w `load()`).

## Konwencje i pułapki

- **Mapowanie pól**: DB snake_case ↔ TS camelCase wyłącznie przez `mapX/toXRow`
  w `store.ts`. Nowa kolumna = aktualizacja mapowania ORAZ `MATCH_LIST_COLUMNS`.
- **Lekkie zapytania**: listy (dashboard, historia, drabinka) używają
  `getMatches({ withTurns: false })` — bez ciężkiego JSONB `turns`. Pełne dane
  tylko tam, gdzie liczone są szczegóły z rzutów.
- **Błędy nie są połykane**: mutacje zwracają `boolean`/`null`; krytyczne miejsca
  (persistMatch, addPlayer) informują użytkownika. Czytajace zwracają `[]`+console.error.
- **Undo korzysta z delt tury**: `Turn.dartsCount`, `doublesAttemptedDelta`,
  `doublesHitDelta` (fallback dla starych danych: darts.length||3, isCheckout?1:0).
  Bust nie liczy lotki kończącej ani 180/ton+. Zmieniając logikę tury — zaktualizuj undo.
- **Lint react-hooks (compiler)**:
  - `Date.now()`/impure w funkcjach komponentu → wrapper modułowy `const now = () => Date.now()`;
  - zero synchronicznego setState w ciele efektu (async IIFE jest OK);
  - stan wyliczalny derivuj w renderze zamiast useEffect.
- **Live sync**: Supabase Realtime (`subscribeToMatch`) + fallback polling 30 s.
  Wymaga publikacji `supabase_realtime` dla tabeli `matches` (sekcja 5 schematu).
- **localStorage/sessionStorage**: `dart_input_mode`, `dart_voice_lang`,
  `history-cache`, `history-scroll`. Goście mają id `guest_*` (pomijani w statystykach).
- Design system: klasa `glass`, kolory `neon-green/yellow/red/blue/purple`,
  font Inter + JetBrains Mono — wszystko w `globals.css` (@theme Tailwind 4).
- Format daty: `pl-PL`. Waluta/kwoty nie występują.

## Deploy / środowisko

- `.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Deploy: push do `main` → Vercel. Zmiany schematu bazy NIE idą przez deploy —
  ręczny SQL w Supabase (patrz wyżej).
- Firebase został usunięty (martwy kod) — nie przywracać.

## Pomysły na przyszłość (zebrane od użytkownika)

Pula wpisowa/zadania dla przegranych, galeria mistrzów + tytuł przy nicku,
MVP turnieju, sezony z rankingiem pkt, typowanie drabinki.
