# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Prywatna grupa znajomych grających w darta (13 graczy w bazie). Wynik wpisuje gracz lub sędzia z telefonem w ręce, w domu przy tarczy, po każdej turze — szybko, między rzutami, często jedną ręką.

## Product Purpose

Ośmiornica liczy mecze 501/301 (tryb szybki: suma tury; szczegółowy: lotka po lotce), prowadzi ranking i statystyki grupy, turnieje pucharowe, pojedynki 1v1 i treningi. Sukces: wpisanie tury nie przerywa gry, a po meczu każdy chce zajrzeć w statystyki i ranking.

## Positioning

Klubowa aplikacja jednej paczki znajomych: wspólna historia, rywalizacje (H2H, nemesis/ofiara), medale okresowe i osiągnięcia — a nie ogólny licznik punktów dla każdego.

## Operating Context

Telefon w ręce (PWA na ekranie głównym), pionowo. Mecz trwa kilkanaście minut, tura co kilka–kilkanaście sekund. Kilka urządzeń może oglądać ten sam mecz na żywo (Supabase Realtime). Głosowe zapowiedzi wyników (pl/en).

## Capabilities and Constraints

- Tryby meczu: ranked (jedyny zasilający statystyki), friendly, tournament, duel; trening: checkout, single, double, triple, punkty.
- Next.js 16 + React 19 + Tailwind CSS 4 + Framer Motion; dane w Supabase.
- UI wyłącznie po polsku, format daty pl-PL.
- Brak kont/logowania — aplikacja prywatna.

## Brand Commitments

- Nazwa „Ośmiornica” zostaje.
- Obecny wygląd (ciemny glass + neonowe akcenty, Inter + JetBrains Mono) NIE jest wiążący — użytkownik dopuszcza pełną zmianę stylu całej aplikacji.

## Evidence on Hand

- Prawdziwe dane: gracze z awatarami (Supabase Storage), ~260 meczów, statystyki, medale.
- Ikona PWA: `public/icons/icon.svg` (tarcza + lotka, tymczasowa).
- Brak logo, maskotki i materiałów marki.

## Product Principles

1. Tura wpisana w 2 sekundy, bez pomyłek — ekran meczu ma pierwszeństwo przed wszystkim.
2. Czytelność z ręki, w ruchu, kątem oka.
3. Rywalizacja w grupie jest paliwem: ranking, H2H, medale mają być widoczne i warte pokazania.
4. Dane są wspólną historią paczki — nic nie może ich po cichu psuć.
