# Approved existing pricing update

Source: live Google Sheets read 2026-10-17, project-price columns on 01/02/03 and scope on 05/06. No old exported workbook used. Sheet: https://docs.google.com/spreadsheets/d/1Xua3GrAYAgYfcbYUEWrU6I6cMZEA0IULLdSuKrbW4DY/edit

## Mapping and price diff (RSD)

Band order: 0–39, 40–59, 60–79, 80–99 m², then RSD/m² from 100 m².

| Stable code | Previous | Approved |
|---|---|---|
| regular | 4000 / 4600 / 5700 / 7200 / 85 | 4900 / 6000 / 8200 / 9800 / **98** |
| deep | 9300 / 10700 / 12900 / 14900 / 180 | 9900 / 11400 / 14200 / 17000 / 180 |
| move | 10200 / 11700 / 14300 / 16400 / 200 | 10700 / 12800 / 15600 / 18400 / 180 |
| airbnb | 4000 / 4500 / 5500 / 6900 / 80 | 4900 / 5800 / 7400 / 9000 / 90 |
| office | 4000 / 4700 / 5900 / 7200 / 75 | 4900 / 5800 / 7400 / 9000 / 90 |

The live regular rate is 98, superseding the task's provisional 95. Existing rounding to 100 RSD remains. At 99→100 m² move falls 18400→18000; deep rises 17000→18000. These approved discontinuities are preserved.

| Existing extra code | Previous | Approved | Unit / source mapping |
|---|---:|---:|---|
| standardWindow | 900 | 1000 | window ≤2 m², ADD-WINDOW-001 |
| largeWindow | 1200 | 1500 | window >2–3 m² |
| balcony | 1100 | 1200 | standard balcony ≤4 m², ADD-OUTDOOR-001 |
| fridge | 1000 | 1000 | appliance, ADD-KITCHEN-001 |
| oven | 1000 | 1400 | appliance, ADD-KITCHEN-004 |
| microwave | 1000 | 700 | appliance |
| hood | 1000 | 1000 | appliance |
| dishwasher | 1000 | 1000 | appliance |
| washingMachine | 1000 | 1000 | appliance |
| cabinets | 900 | 500 | empty section ≤60 cm wide, ≤90 cm high, ≤2 shelves, ADD-KITCHEN-017 |
| ironing | 900 | 900 | **30 minutes**, correct old DB hour unit |
| linen | 750 | 750 | bed; charged separately also for Airbnb |
| petHair | 900 | 900 | order, standard additional scope |
| steam | 2800 | 2800 | existing local eco steam package |

39 existing area/extra tariff cells aligned; 30 numerical changes (24 area + 6 extras). No codes added or removed.

| Upholstery stable key | Previous | Approved | Mapping |
|---|---:|---:|---|
| sofa3Light | 2500 | 4600 | legacy key retained, same three-seat starting price |
| sofa3Normal | 3000 | 4600 | UPH-SOFA-002; canonical three-seat public row |
| sofa3Heavy | 3800 | 4600 | legacy key retained; heavy dirt requires review, no automatic markup |
| sofa2 | 2400 | 4000 | UPH-SOFA-001 |
| armchair | 1200 | 2200 | UPH-CHAIR-001 |
| chair | 500 | 600 | seat and back, UPH-CHAIR-007 |
| cornerSeat | 900 | 2000 | additional seat beyond four, UPH-SOFA-006 |
| spot | 1500 | 1000 | small local treatment with cleaning, UPH-SPOT-001 |
| minimumVisit | 3000 | 4000 | standalone order floor, not an extra fee |

Corner sofas now correctly start at **5600 per whole sofa up to four seats**, plus 2000 for each additional seat. Owner explicitly resolved the contradictory stale 1000 note in the Sheet in favor of project price 2000. Existing request seat counts and identifiers remain. Two obsolete three-seat dirt variants are omitted from public tables; seven existing public rows remain, all item prices marked “from”. Nine legacy catalogue values updated plus the corrected whole-corner base.

## Scope and exclusions

Five existing package descriptions updated RU/SR/EN: accessible regular work and one bathroom; deep adds doors/skirting/switches/fronts, accessible radiators/lights, bounded local limescale and one laundry load ≤5 kg; move is empty normal household condition; Airbnb linen is extra; office includes one bathroom/coffee point/ordinary waste.

All other Sheet extras remain outside scope (including additional bathrooms, specialist/deep tasks and commercial variants). No 280-row catalogue import. Four-seat sofa 5100, mattresses one side 2000/3200 and low/high-pile carpets 450/550 per m² have no existing deterministic furniture keys or numeric public rows: manual enquiry remains, no foreign-price mapping or new calculator. No unresolved mapping is silently guessed.

## Safe rollout

`node --import tsx scripts/admin/update-existing-pricing.ts` prints a dry run. Add `--apply` only for the intended DB. It requires existing active stable codes, closes current area-band validity and appends a new version, updates existing extras/settings only, and increments upholstery version only on change. Second application is a no-op. Missing/ambiguous catalogue shapes abort. It locks and verifies hashes/counts of historical Orders, snapshots, clients, leads, finance, BusinessSettings and DurationRule in the same transaction. It does not alter client discounts, channel modes, extractor quantity or historical prices.

Isolated Neon branch: `pricing-update-20261017`. No resets and no production test Orders. Existing signed live-booking proof remains an independent safety gate tied to source fingerprint; do not fabricate or bypass it. Updated deep-cleaning scope may need a separately approved duration review; no duration extrapolation or scheduler changes are included here.

## Verification

- 745 regression assertions PASS; 24 unrelated DB suites explicitly skipped. Another 61 actual pricing-tool assertions PASS on the isolated branch: all 45 area boundary cases, existing extras and combined appliances agree across public calculation, CRM and AI tools. No Orders created by these pricing tests.
- TypeScript, production build and source ESLint PASS (two unchanged website-chat image warnings; generated MapLibre vendor files excluded from the source lint invocation).
- Actual Vercel Preview: `lumaclean-dl85kv4qi-vladislavs-projects-0eae0ea3.vercel.app`, application source fingerprint `e49637a1de5dadfa8cc665f0a27c69ef1889955ccc69d568f68f1d5cc5a1eea9`.
- RU/SR/EN homepage plus all 18 existing service pages checked at 1440/430/390/360 px: 84 layout checks, no page overflow. Prices, units and FAQ present. Existing five service radios, ten quantity extras, toggles and unified upholstery enquiry retained. Functional browser example: regular 55 m² + fridge + oven = 8400 RSD; upholstery checkbox adds manual confirmation, and upholstery-only shows no invented numeric total. No public enquiry submitted.
- Existing Preview native booking test: all eight steps PASS using PoYo, regular 50 m² = 6000 RSD, two cleaners, unchanged duration/reserves/transport. Synthetic Order cleaned; signed report generated for this application source. No production Order used.
- Preview catalogue migration PASS; repeat application no-op. Protected history hashes unchanged by catalogue update. Production rollout must use the same updater and retain the independent signed booking-report validation.
- No static old numeric appliance tariff remains in runtime AI knowledge; `getBusinessInfo` reads the shared current catalogue. Historical audit documentation still intentionally records old prices and is not runtime knowledge. AI prompts/persona/flows/provider/channel configuration were not changed.
