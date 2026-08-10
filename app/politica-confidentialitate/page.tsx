import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politica de confidențialitate",
  description:
    "Politica de confidențialitate a aplicației Prezenta: ce date personale colectăm, cum le folosim și cum poți exercita drepturile tale.",
  robots: {
    index: true,
    follow: true,
  },
};

const LAST_UPDATED = "10 august 2026";

export default function PoliticaConfidentialitatePage() {
  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Înapoi
        </Link>

        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <header className="mb-8 border-b border-zinc-200 pb-6">
            <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
              Politica de confidențialitate
            </h1>
            <p className="mt-3 text-sm text-zinc-500">
              Ultima actualizare: {LAST_UPDATED}
            </p>
            <p className="mt-4 text-base leading-relaxed text-zinc-600">
              Această politică descrie modul în care aplicația{" "}
              <strong className="font-semibold text-zinc-800">Prezenta</strong>{" "}
              („aplicația”, „noi”) prelucrează datele personale atunci când
              utilizezi serviciile noastre de organizare a evenimentelor
              sportive și de confirmare a prezenței.
            </p>
          </header>

          <div className="space-y-8 text-base leading-relaxed text-zinc-700">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                1. Operatorul datelor
              </h2>
              <p>
                Operatorul datelor personale prelucrate prin aplicația Prezenta
                poate fi contactat la adresa de e-mail{" "}
                <a
                  href="mailto:teebeesimon@gmail.com"
                  className="font-medium text-emerald-600 hover:text-emerald-700"
                >
                  teebeesimon@gmail.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                2. Ce face aplicația
              </h2>
              <p className="mb-3">
                Prezenta permite utilizatorilor autentificați să:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  se autentifice cu un cont Google pentru a folosi aplicația;
                </li>
                <li>
                  creeze și editeze evenimente sportive (de exemplu fotbal,
                  tenis, padel), inclusiv detalii despre dată, oră, locație și
                  număr maxim de participanți (în funcție de rolul atribuit);
                </li>
                <li>
                  confirme prezența la evenimente (răspunsuri de tip „vin”,
                  „poate” sau „nu vin”);
                </li>
                <li>
                  vizualizeze listele de participanți și, pentru organizatori,
                  genereze echipe aleatorii pe baza celor confirmați.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                3. Ce date personale colectăm
              </h2>
              <p className="mb-3">
                Colectăm doar datele necesare pentru funcționarea aplicației:
              </p>

              <h3 className="mb-2 mt-4 text-base font-semibold text-zinc-900">
                3.1. Date din autentificarea Google
              </h3>
              <p className="mb-3">
                Autentificarea se face prin Firebase Authentication, folosind
                Google Sign-In. Din contul tău Google putem primi, în special:
              </p>
              <ul className="mb-3 list-disc space-y-2 pl-5">
                <li>identificatorul unic al contului (UID);</li>
                <li>adresa de e-mail;</li>
                <li>numele afișat (display name);</li>
                <li>fotografia de profil (dacă este disponibilă).</li>
              </ul>

              <h3 className="mb-2 mt-4 text-base font-semibold text-zinc-900">
                3.2. Profilul de utilizator din aplicație
              </h3>
              <p className="mb-3">
                La autentificare, creăm sau actualizăm un profil în Firestore,
                care poate include:
              </p>
              <ul className="mb-3 list-disc space-y-2 pl-5">
                <li>UID, nume afișat și e-mail;</li>
                <li>
                  rolul în aplicație (utilizator, organizator sau
                  super-administrator);
                </li>
                <li>data creării și, după caz, data ultimei actualizări.</li>
              </ul>

              <h3 className="mb-2 mt-4 text-base font-semibold text-zinc-900">
                3.3. Date despre evenimente
              </h3>
              <p className="mb-3">
                Când un organizator creează sau editează un eveniment, stocăm
                informații precum: titlu, sport, dată, oră, număr maxim de
                participanți, identificatorul proprietarului evenimentului,
                locația (nume, identificator de tip Place ID, coordonate
                geografice) și, dacă este cazul, echipele generate (inclusiv
                participanții asociați).
              </p>

              <h3 className="mb-2 mt-4 text-base font-semibold text-zinc-900">
                3.4. Răspunsuri de prezență
              </h3>
              <p className="mb-3">
                Când confirmi prezența la un eveniment, stocăm: identificatorul
                evenimentului, identificatorul tău de utilizator, numele afișat,
                fotografia de profil (dacă este disponibilă), statusul ales
                („vin”, „poate”, „nu vin”), precum și datele de creare /
                actualizare ale răspunsului.
              </p>

              <h3 className="mb-2 mt-4 text-base font-semibold text-zinc-900">
                3.5. Date tehnice de funcționare
              </h3>
              <p>
                Furnizorii de infrastructură (de exemplu Firebase / Google Cloud
                și platforma de hosting) pot prelucra date tehnice uzuale
                necesare livrării serviciului (cum ar fi jurnale de securitate
                sau date de sesiune legate de autentificare). Aplicația nu
                implementează instrumente proprii de analiză a comportamentului
                (analytics) sau de publicitate.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                4. Scopurile prelucrării
              </h2>
              <p className="mb-3">Prelucrăm datele personale pentru a:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>permite autentificarea și gestionarea contului;</li>
                <li>
                  permite crearea, editarea, vizualizarea și administrarea
                  evenimentelor;
                </li>
                <li>
                  înregistra și afișa răspunsurile de prezență către
                  participanții autentificați ai evenimentului;
                </li>
                <li>
                  permite generarea echipelor pe baza participanților
                  confirmați;
                </li>
                <li>
                  gestiona rolurile și accesul (inclusiv panoul de
                  administrare, disponibil doar pentru super-administratori);
                </li>
                <li>
                  asigura securitatea, stabilitatea și funcționarea corectă a
                  aplicației;
                </li>
                <li>
                  răspunde solicitărilor privind drepturile tale asupra datelor
                  personale.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                5. Temeiul legal
              </h2>
              <p>
                Prelucrarea se bazează, după caz, pe executarea serviciului pe
                care îl soliciți prin utilizarea aplicației (autentificare,
                organizare evenimente, confirmare prezență), pe interesul
                legitim de a asigura securitatea și buna funcționare a
                platformei și, acolo unde este necesar, pe consimțământul tău
                (de exemplu atunci când alegi să te autentifici cu Google sau să
                furnizezi o locație prin sugestiile Google Maps).
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                6. Cui divulgăm datele
              </h2>
              <p className="mb-3">
                Nu vindem datele personale. Datele pot fi prelucrate de
                următorii destinatari, în măsura necesară funcționării
                aplicației:
              </p>
              <ul className="mb-3 list-disc space-y-2 pl-5">
                <li>
                  <strong className="font-semibold text-zinc-800">
                    Google / Firebase
                  </strong>{" "}
                  — autentificare (Google Sign-In), stocare în Firestore și,
                  pentru organizatori, autocompletarea locațiilor prin Google
                  Maps Places;
                </li>
                <li>
                  <strong className="font-semibold text-zinc-800">
                    Furnizorul de hosting
                  </strong>{" "}
                  — pentru găzduirea și livrarea aplicației web;
                </li>
                <li>
                  <strong className="font-semibold text-zinc-800">
                    Alți utilizatori autentificați
                  </strong>{" "}
                  — în contextul unui eveniment, pot vedea numele, fotografia
                  de profil (dacă există) și statusul de prezență ale
                  participanților, precum și detaliile evenimentului; echipele
                  generate pot fi vizibile după ce sunt create.
                </li>
              </ul>
              <p>
                Putem divulga date dacă suntem obligați prin lege sau dacă este
                necesar pentru a proteja drepturile, siguranța sau
                integritatea aplicației și a utilizatorilor.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                7. Transferuri internaționale
              </h2>
              <p>
                Serviciile Google / Firebase și infrastructura de hosting pot
                implica prelucrarea sau stocarea datelor pe servere situate în
                afara României sau a Spațiului Economic European. În aceste
                cazuri, transferurile se realizează în conformitate cu
                măsurile și garanțiile aplicabile furnizorilor respectivi.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                8. Durata stocării
              </h2>
              <p>
                Păstrăm datele pe durata utilizării contului și a existenței
                evenimentelor / răspunsurilor asociate, precum și atât timp cât
                este necesar pentru funcționarea aplicației sau pentru
                îndeplinirea unor obligații legale. Poți solicita ștergerea sau
                restricționarea datelor tale folosind datele de contact de mai
                jos.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                9. Securitate
              </h2>
              <p>
                Folosim Firebase Authentication și reguli de acces Firestore
                pentru a limita citirea și scrierea datelor la utilizatorii
                autentificați și la rolurile corespunzătoare. Nicio metodă de
                transmitere sau stocare electronică nu este complet sigură;
                depunem eforturi rezonabile pentru a proteja datele, însă nu
                putem garanta securitate absolută.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                10. Cookie-uri și tehnologii similare
              </h2>
              <p>
                Aplicația nu folosește cookie-uri proprii de marketing sau de
                analiză. Autentificarea Firebase / Google poate utiliza
                mecanisme de sesiune sau stocare locală în browser, necesare
                pentru menținerea stării de autentificare. Google Maps, atunci
                când este folosit pentru selectarea locației, poate încărca
                resurse ale Google conform politicilor acestora.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                11. Drepturile tale
              </h2>
              <p className="mb-3">
                În măsura prevăzută de legislația aplicabilă (inclusiv GDPR,
                dacă este cazul), poți solicita:
              </p>
              <ul className="mb-3 list-disc space-y-2 pl-5">
                <li>accesul la datele tale personale;</li>
                <li>rectificarea datelor inexacte;</li>
                <li>ștergerea datelor („dreptul de a fi uitat”);</li>
                <li>restricționarea prelucrării;</li>
                <li>opoziția față de anumite prelucrări;</li>
                <li>
                  portabilitatea datelor, acolo unde este aplicabil.
                </li>
              </ul>
              <p>
                Pentru a exercita aceste drepturi sau pentru orice întrebare
                legată de confidențialitate, scrie-ne la{" "}
                <a
                  href="mailto:teebeesimon@gmail.com"
                  className="font-medium text-emerald-600 hover:text-emerald-700"
                >
                  teebeesimon@gmail.com
                </a>
                . Ai, de asemenea, dreptul de a depune o plângere la autoritatea
                de supraveghere competentă (în România: ANSPDCP).
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                12. Copii
              </h2>
              <p>
                Aplicația nu este destinată copiilor sub 16 ani. Nu colectăm
                în mod conștient date personale de la minori. Dacă aflăm că am
                colectat astfel de date, vom lua măsuri pentru a le șterge.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                13. Modificări ale acestei politici
              </h2>
              <p>
                Putem actualiza această politică pentru a reflecta schimbări
                ale aplicației sau ale cerințelor legale. Versiunea actuală
                va fi publicată pe această pagină, împreună cu data ultimei
                actualizări.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                14. Contact
              </h2>
              <p>
                Pentru solicitări privind datele personale sau această
                politică de confidențialitate, ne poți contacta la{" "}
                <a
                  href="mailto:teebeesimon@gmail.com"
                  className="font-medium text-emerald-600 hover:text-emerald-700"
                >
                  teebeesimon@gmail.com
                </a>
                .
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
