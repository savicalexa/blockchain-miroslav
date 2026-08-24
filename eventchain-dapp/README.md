# EventChain

EventChain je kompletna decentralizovana aplikacija za upravljanje događajima. Podaci se čuvaju u Solidity pametnom ugovoru, dok React interfejs omogućava povezivanje MetaMask novčanika i izvršavanje CRUD operacija na Ethereum mreži.

Projekat je realizovan kao studentski zadatak iz oblasti blokčejn tehnologija.

## Funkcionalnosti

- povezivanje sa MetaMask novčanikom;
- automatsko prepoznavanje i promena Ethereum mreže;
- kreiranje novog događaja;
- prikaz svih, aktivnih, sopstvenih i deaktiviranih događaja;
- pretraga prema nazivu i lokaciji;
- izmena događaja od strane njegovog organizatora;
- logičko brisanje, odnosno deaktivacija događaja;
- prijavljivanje korisnika na aktivan događaj;
- otkazivanje sopstvene prijave pre početka događaja;
- prikaz popunjenosti i slobodnih mesta;
- sprečavanje duplih prijava i prekoračenja kapaciteta;
- filter događaja na koje je povezani novčanik prijavljen;
- validacija podataka u interfejsu i pametnom ugovoru;
- automatsko osvežavanje podataka nakon potvrđene transakcije;
- automatizovani testovi pametnog ugovora;
- podrška za lokalnu Hardhat mrežu i Sepolia testnu mrežu.

## Tehnologije

| Sloj                       | Tehnologija                       |
| -------------------------- | --------------------------------- |
| Pametni ugovor             | Solidity 0.8.28                   |
| Razvoj i testiranje        | Hardhat 3, Mocha, Chai            |
| Komunikacija sa blokčejnom | ethers.js 6                       |
| Korisnički interfejs       | React 19, TypeScript, Vinext/Vite |
| Novčanik                   | MetaMask                          |
| Lokalne i testne mreže     | Hardhat Network, Sepolia          |

## Arhitektura

flowchart LR
U[Korisnik] --> UI[React interfejs]
UI --> M[MetaMask]
M --> E[Ethereum mreža]
E --> C[EventManager ugovor]
C --> E
E --> UI

````

Za operacije čitanja interfejs direktno poziva `view` funkcije ugovora. Kreiranje, izmena, deaktivacija, prijava i otkazivanje prijave menjaju stanje mreže i zato zahtevaju da korisnik potvrdi transakciju u MetaMask-u.

## CRUD operacije

| CRUD | Funkcija ugovora | Opis |
| --- | --- | --- |
| Create | `createEvent` | Kreira događaj i čuva adresu organizatora. |
| Read | `getEvent`, `getAllEvents`, `getActiveEvents`, `getEventsByOrganizer` | Čita pojedinačne ili filtrirane zapise. |
| Update | `updateEvent` | Menja podatke aktivnog događaja. |
| Delete | `deleteEvent` | Postavlja `active` na `false`. |

Prijave predstavljaju dodatno stanje povezano sa događajem. Funkcije `registerForEvent` i `cancelRegistration` menjaju broj zauzetih mesta, dok `isRegistered` proverava status određenog novčanika.

Podaci zapisani na blokčejn ne mogu fizički da se izbrišu. Zato je brisanje implementirano kao promena statusa, čime zapis ostaje proverljiv u istoriji mreže.

## Preduslovi

- Node.js 22.13 ili noviji;
- npm;
- MetaMask ekstenzija za pregledač.

## Lokalno pokretanje

### 1. Instaliranje zavisnosti

U korenu projekta pokrenuti:

```bash
npm install
````

### 2. Pokretanje lokalne Ethereum mreže

U prvom terminalu:

```bash
npm run contract:node
```

Hardhat će prikazati razvojne naloge i njihove privatne ključeve. Jedan od tih naloga može da se uveze u MetaMask isključivo za lokalno testiranje.

> Privatni ključevi koje prikazuje lokalni Hardhat čvor javno su poznati i nikada se ne smeju koristiti na pravoj mreži niti za čuvanje stvarnih sredstava.

### 3. Postavljanje pametnog ugovora

Dok prvi terminal i dalje radi, u drugom terminalu pokrenuti:

```bash
npm run contract:deploy
```

Skripta postavlja `EventManager` na lokalnu mrežu i automatski upisuje njegovu adresu u `public/deployment.json`.

### 4. Pokretanje web aplikacije

U trećem terminalu:

```bash
npm run dev
```

Otvoriti adresu koju Vite prikaže u terminalu, obično `http://localhost:5173`.

### 5. Povezivanje MetaMask-a

Klikom na **Poveži MetaMask** aplikacija traži pristup novčaniku. Ako lokalna mreža nije već dodata, dugme **Promeni** dodaje sledeću konfiguraciju:

| Polje       | Vrednost                |
| ----------- | ----------------------- |
| Naziv mreže | Hardhat Local           |
| RPC URL     | `http://127.0.0.1:8545` |
| Chain ID    | `31337`                 |
| Valuta      | ETH                     |

## Testiranje

Kompajliranje ugovora:

```bash
npm run contract:compile
```

Pokretanje testova pametnog ugovora:

```bash
npm run test:contract
```

Provera ugovora i web aplikacije:

```bash
npm test
```

Testovi proveravaju CRUD operacije, autorizaciju organizatora, prijavljivanje, otkazivanje prijave, zabranu duplih prijava, kontrolu kapaciteta i odbijanje neispravnih podataka.

## Postavljanje na Sepolia mrežu

Hardhat čuva osetljive vrednosti u šifrovanom keystore-u. Uneti Sepolia RPC adresu i privatni ključ razvojnog naloga:

```bash
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

Zatim postaviti ugovor:

```bash
npm run contract:deploy:sepolia
```

Nalog mora da poseduje malu količinu Sepolia ETH-a za plaćanje naknade. Deployment skripta će ažurirati `public/deployment.json`, nakon čega web aplikaciju treba ponovo izgraditi ili pokrenuti.

## Struktura projekta

```text
eventchain-dapp/
├── app/
│   ├── globals.css              # kompletan responzivni dizajn
│   ├── layout.tsx               # metapodaci i osnovni raspored
│   └── page.tsx                 # MetaMask i CRUD korisnički interfejs
├── contracts/
│   └── EventManager.sol         # Solidity pametni ugovor
├── docs/
│   └── ODBRANA.md               # kratka priprema za odbranu projekta
├── lib/
│   └── eventManager.ts          # ABI, tipovi i ethers pomoćne funkcije
├── public/
│   └── deployment.json          # adresa i mreža postavljenog ugovora
├── scripts/
│   └── deploy.ts                # deployment skripta
├── test/
│   └── EventManager.ts          # testovi pametnog ugovora
├── hardhat.config.ts            # Hardhat i mrežna konfiguracija
└── package.json                 # zavisnosti i komande
```

## Pravila pametnog ugovora

- Organizator je `msg.sender` adresa koja je kreirala događaj.
- Samo organizator može da izmeni ili deaktivira svoj događaj.
- Datum događaja mora biti u budućnosti.
- Kapacitet mora biti veći od nule.
- Kapacitet se ne može smanjiti ispod broja već prijavljenih korisnika.
- Jedan novčanik može imati najviše jednu prijavu po događaju.
- Organizator ne rezerviše mesto na sopstvenom događaju.
- Prijava je moguća samo dok je događaj aktivan, nije počeo i ima slobodnih mesta.
- Prijavljeni korisnik može da otkaže svoju prijavu pre početka događaja.
- Naziv i lokacija su obavezni i imaju ograničenu dužinu zbog cene čuvanja podataka.
- Deaktiviran događaj više ne može da se menja ili ponovo deaktivira.
- Svaka važna promena emituje Solidity događaj, uključujući `EventCreated`, `EventUpdated`, `EventDeleted`, `AttendeeRegistered` i `RegistrationCancelled`.
