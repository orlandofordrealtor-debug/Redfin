# Redfin's Sold Standard — Product Specification (handoff)

- The product name is "Redfin's Sold Standard" (constant APP_NAME in dashboard.html).
- The tagline is "Stale Listing Command Center" (constant APP_TAG in dashboard.html).
- The product is a single-file HTML page (dashboard.html, about 299 KB, 1446 lines) published as a Claude Artifact with the db, user, sample (Claude) and downloads capabilities.
- The live artifact URL recorded in README.md is https://claude.ai/artifact/81ALWMGv7Ku9ATQf1iHA2T.
- The audience is a Redfin Powered by Rocket sales manager in Los Angeles running the weekly stale listings hour.
- The page's brand bar loads brand/logo.svg (light theme) and brand/logo-reversed.svg (dark theme); brand/mark.svg also exists in the repo but is not referenced by the page.
- The page loads fonts Outfit (500/600/700) and Source Sans 3 (400/600/700/italic 400) from Google Fonts.
- The page loads html2canvas 1.4.1, jspdf 2.5.1 and xlsx 0.18.5 from cdnjs.cloudflare.com.
- All business logic runs in the browser in the page's JavaScript; the Python pipeline only prepares database documents.
- All figures produced by the pricing and cost-of-waiting models are labelled "planning estimates, not appraisals" in the exports.

# 1. Data sources and input files

## Weekly active listings sheet (data/weekly/<date>.csv)
- The file is the Redfin "active listings" sheet exported as CSV and saved as data/weekly/<date>.csv (for example data/weekly/2026-10-26.csv).
- It is read by pipeline/fetch_listings.py with csv.DictReader using encoding utf-8-sig.
- It is also read by the page's Weekly upload tab (function handleCSV with a hand-written parser parseCSV that strips a leading BOM from the first header).
- The key field is "Deal Id".
- Column "Deal Id" is the deal identifier string (stripped); it becomes dealId.
- Column "Deal Status" becomes status (for example "Active Listing").
- Column "List Date" becomes listDate, parsed with formats %m/%d/%y, %m/%d/%Y, %Y-%m-%d into ISO (page parser accepts M/D/YY, M/D/YYYY and YYYY-MM-DD).
- Column "Check In Date" becomes checkInDate (same date parsing).
- Column "Listing Expiration Date" becomes expirationDate (same date parsing).
- Column "Agent Name" becomes agent.
- Column "Street Address" becomes address, stripped of whitespace and a trailing comma.
- Column "City" becomes city.
- Column "State Code" becomes state.
- Column "Price Drop?" becomes priceDrop, true when the upper-cased value is "Y".
- Column "Price Drop Amt" becomes priceDropAmt, parsed by money() which strips "$" and ",", and multiplies a trailing "K" by 1000 and a trailing "M" by 1000000 (for example "$40K" becomes 40000).
- Column "Last Price Reduction Date" becomes lastReductionDate (date parsing).
- Column "Days On Mkt" becomes dom as an integer only when the stripped value is all digits, otherwise None (null).
- Column "Deal URL" becomes dealUrl (for example https://www.redfin.com/tools/new/deals/sell/4150719).
- Column "Suggested Price Amount" becomes suggestedPrice (money parsing).
- Column "Original Price Amount" becomes originalPrice (money parsing).
- Column "Current Price" becomes currentPrice (money parsing).
- Column "Current Redfin Estimate" becomes redfinEstimate (money parsing).
- Column "Predicted Close Price Amount" becomes predictedClose (money parsing).
- Column "Hot Home Score" becomes hotHome, true only when the stripped value is exactly "1" (a probability like 0.3838 is treated as not hot).
- The page's upload tab lists exactly these twenty column names as the expected columns and rejects a file whose first row has no "Deal Id" column.
- A sheet row with address "-" or city "-" (or empty) is treated as having no address and is not resolved on Redfin.
- Rows in the weekly folder on disk at handoff: 2026-10-07.csv, 2026-10-13.csv, 2026-10-26.csv.

## Open house sheet (data/weekly/openhouse-<date>.csv)
- The file is the trailing-six-month open house sheet, one row per deal, saved as data/weekly/openhouse-<date>.csv (files on disk: openhouse-2026-10-14.csv, openhouse-2026-10-26.csv).
- It is read by pipeline/openhouse.py with csv.DictReader (utf-8-sig); header names are normalized by lower-casing and removing every non-alphanumeric character before lookup.
- The header on disk is: Business Market, Deal Agent Role, Deal Agent Name, Address, Deal ID, Deal URL, Listing Price, Redfin Commission, Convertable Sign Ins, Estimated OH Costs, Sign Ins, Diff from Norm, Norm Opens, Open Houses, Price Drop Open Houses.
- The normalized keys the script reads are businessmarket, dealagentrole, dealagentname, address, dealid, dealurl, listingprice, redfincommission, convertablesignins, estimatedohcosts, signins, normopens, openhouses, pricedropopenhouses.
- Column "Diff from Norm" is not read; vsNorm is recomputed as opens minus norm.
- The sheet is grouped, so "Business Market", "Deal Agent Role" and "Deal Agent Name" are only filled on the first row of a group and are forward-filled by the script.
- The key field is "Deal ID"; rows without a deal id are skipped.
- Money columns are parsed by stripping "$" and "," and converting to float (0.0 when empty or invalid); count columns are int(float(value)) (0 when empty or invalid).
- The sheet lists only deals that passed the open house norm in the trailing six months, active or not.

## Open house event export (data/weekly/openhouse-events-<date>.csv, optional)
- The optional event-level export has one row per open house and is passed to openhouse.py with --events.
- Column names are flexible; the script picks the first match among normalized names: deal id from dealid, deal, dealnumber; date from date, openhousedate, eventdate, start, starttime; host from host, hostname, hostedby, agent, hostagent, openhousehost; role from hostrole, role, hosttype, hostagentrole; sign-ins from signins, signin, visitors, attendees; cost from cost, estimatedcost, estimatedohcost, ohcost.
- If no deal id column is found the whole file is ignored (returns an empty map).
- The host role string is mapped: contains "assoc" -> "associate"; contains "listing" or equals "agent" or "la" -> "listingAgent"; any other non-empty value -> "teamAgent"; empty -> "unknown".
- No event export exists on disk at handoff and ohweek.json carries eventsLoaded false.

## Private exclusives sheet (data/weekly/exclusives-<date>.csv)
- The file is the internal private exclusive inventory sheet saved as data/weekly/exclusives-<date>.csv (files on disk: exclusives-2026-10-15.csv, exclusives-2026-10-26.csv).
- It is read by pipeline/early_access.py with csv.DictReader (utf-8-sig); header keys are stripped and upper-cased because header case varies week to week.
- The header on disk is: Address, SQFT, Beds, Baths, Price, Market, URL, Description.
- The script reads ADDRESS, SQFT, BEDS, BATHS, PRICE, MARKET, URL, DESCRIPTION.
- The key field is the Redfin property id parsed from the URL column with the regex /home/(\d+); when the URL has no property id the key is "x" followed by the first 12 digits of the address.
- A URL starting with "/" is prefixed with https://www.redfin.com.
- The address is split on commas: the first part is the street, the second part is the city; the zip is the first 5-digit number starting with 9 found in the address.
- Numeric columns are parsed by stripping every character except digits and "." (PRICE, BEDS, BATHS, SQFT become floats).

## Cached and intermediate files
- data/raw/<dealId>.json holds the cached raw Redfin payload per deal (written by fetch_listings.py; refetched after cache_days, default 6).
- data/raw/ea/cities.json caches Redfin city region ids keyed by lower-cased city name (written by early_access.py).
- data/raw/ea/crawl-<date>.json caches the latest coming-soon crawl with keys asOf, homes, centroids (written by early_access.py; files on disk crawl-2026-10-15.json, crawl-2026-10-26.json).
- data/snapshots/<date>.json holds the enriched records for the week with keys asOf, count, records (written by fetch_listings.py).
- data/db/<date>/ holds the documents pushed to the database: listings/, photos/, openhouses/, earlyaccess/, week.json, ohweek.json, eaweek.json, meta.json, market.json, playbook.json, manifest.json, oh-manifest.json, ea-manifest.json, push-context.json, batches/.
- data/db/versions.json maps "collection/doc_id" to the document version currently in the artifact database (901 entries at handoff: earlyaccess 393, listings 211, photos 175, openhouses 112, weeks 3, eaweeks 2, ohweeks 2, market 1, meta 1, playbook 1).
- data/playbook.json is the coaching framework pushed as playbook/current (version "2026-10-07b").
- data/market.json is the market context pushed as market/current (asOf "2026-10-07").
- data/coach.json exists and is byte-identical in content to playbook.json's "coach" object; no script reads it, so its role is UNVERIFIED.
- docs/MASTER-REBUILD-PROMPT.md exists in the repo but was not part of the source set for this specification. UNVERIFIED
- data/db/<date>/batches/batch-gone.json contains ArtifactData "update" operations that set status "Removed from sheet" and removedAt on each gone listing; no pipeline script writes this file; Claude builds it each week with a short Python snippet from meta.changes.gone and versions.json during the push (see section 16).

# 2. Database collections and every field

## General rules
- Every collection lives in the published artifact's shared database and the page subscribes to each with onSnapshot.
- The page reads listings, coaching, meta/current, market/current, playbook/current, openhouses, earlyaccess, eaweeks, eameta, ohweeks and weeks at boot; photos/<dealId> is fetched on demand when a property page opens.
- The pipeline pushes documents with the ArtifactData batch tool, 50 writes per call and at most 980,000 bytes of files per batch.
- Documents that already exist carry "if_version" pins taken from data/db/versions.json; new documents carry no pin.

## listings/<dealId>
- The document id is the sheet's Deal Id string.
- It is written by pipeline/seed_db.py (op "set"), by the page's Weekly upload tab (db.doc("listings/<id>").set), and by the hand-made batch-gone.json (op "update" setting status "Removed from sheet" and removedAt).
- The page ignores any listing document whose status is "Removed from sheet".
- Field dealId (string): the Deal Id.
- Field status (string): the sheet's Deal Status; the page's upload sets "Removed from sheet" for ids missing from the new sheet.
- Field removedAt (ISO date string): set only by the page upload or batch-gone.json when a listing leaves the sheet.
- Field listDate (ISO date or null): from "List Date".
- Field checkInDate (ISO date or null): from "Check In Date"; stored but not rendered by the page.
- Field expirationDate (ISO date or null): from "Listing Expiration Date".
- Field agent (string): from "Agent Name".
- Field address (string): from "Street Address" with trailing comma removed.
- Field city (string): from "City".
- Field state (string): from "State Code".
- Field priceDrop (boolean): "Price Drop?" equals "Y".
- Field priceDropAmt (integer or null): from "Price Drop Amt".
- Field lastReductionDate (ISO date or null): from "Last Price Reduction Date".
- Field dom (integer or null): from "Days On Mkt".
- Field dealUrl (string): from "Deal URL".
- Field suggestedPrice (integer or null): from "Suggested Price Amount"; stored but not used in any page formula.
- Field originalPrice (integer or null): from "Original Price Amount".
- Field currentPrice (integer or null): from "Current Price".
- Field redfinEstimate (integer or null): from "Current Redfin Estimate".
- Field predictedClose (integer or null): from "Predicted Close Price Amount".
- Field hotHome (boolean): "Hot Home Score" equals "1".
- Field asOf (ISO date): the snapshot date passed as --asof (page upload uses today's date).
- Field tier (string): "watch", "stale", "ultra", "extreme" or "unknown" from dom (see section 3).
- Field band (string): "under750", "750to1500", "1500to3000", "over3000" or "unknown" from currentPrice (see section 3).
- Field dataIssues (array of strings): "No address in sheet" when address is "" or "-"; "No current price in sheet" when currentPrice is falsy; seed_db.py removes any entry containing "Redfin" when Redfin data is carried forward.
- Field daysToExpiration (integer or null): expirationDate minus asOf in days (only present when expirationDate exists in the pipeline; page upload sets null when absent).
- Field gapToEstimatePct (number or null): round((currentPrice - redfinEstimate) / redfinEstimate * 100, 1) when both exist.
- Field gapToPredictedPct (number or null): round((currentPrice - predictedClose) / predictedClose * 100, 1) when both exist.
- Field reductionPct (number): round((originalPrice - currentPrice) / originalPrice * 100, 1) when originalPrice > currentPrice, else 0.0.
- Field redfin (object): the Redfin.com enrichment block described below; the page upload keeps the previous block and adds stale:true when it was ok, otherwise writes {ok:false, pending:true}.
- Field history (array): one entry per weekly snapshot, capped to the last 26 entries, described below.
- Field _mortgage (number): page-only, in-memory, never written; copied from coaching.plan.mortgage for the carrying cost.

### listings.redfin{} block
- Field ok (boolean): true when Redfin's aboveTheFold addressSectionInfo was found.
- Field error (string): present when the fetch failed, for example "no address in sheet", "address not found on Redfin", or "<ExceptionType>: <message>".
- Field pending (boolean): page upload only, true when no enrichment exists yet.
- Field stale (boolean): page upload only, true when the block came from a previous enrichment.
- Field url (string): "https://www.redfin.com" plus the resolved listing path.
- Field propertyId (string): Redfin propertyId parsed from the listing page or autocomplete.
- Field listingId (string or null): Redfin listingId parsed from the listing page.
- Field status (string): addressSectionInfo.status.displayValue (for example "Active").
- Field price (number): addressSectionInfo.priceInfo.amount.
- Field sqft (number): addressSectionInfo.sqFt.value.
- Field pricePerSqft (number): addressSectionInfo.pricePerSqFt.
- Field beds (number) and baths (number): from addressSectionInfo.
- Field yearBuilt (number), lotSize (number), zip (string): from addressSectionInfo.
- Field lat (number) and lng (number): addressSectionInfo.latLong.latitude and .longitude.
- Field cumulativeDom (number): addressSectionInfo.cumulativeDaysOnMarket.
- Field domLabel (string): addressSectionInfo.daysOnMarketLabel (for example "Cumulative").
- Field isHot (boolean): addressSectionInfo.isHot.
- Field hasOpenHouse (boolean): addressSectionInfo.hasOpen.
- Field isRedfin (boolean): addressSectionInfo.isRedfin.
- Field estimate (number): addressSectionInfo.avmInfo.predictedValue (the Redfin Estimate from Redfin.com).
- Field propertyType (number): addressSectionInfo.propertyType code.
- Field photoCount (integer): number of photos in mediaBrowserInfo.photos.
- Field photoTypes (array of strings): sorted distinct photoType values (for example ["DEAL"]).
- Field lowResPhotos (integer): count of photos whose width is known and under 1024 pixels.
- Field remarks (string): the listing remarks scraped from the listing page (listingRemarks div, else marketingRemarks JSON).
- Field remarksLength (integer): length of remarks in characters.
- Field listedBy (string): the listing agent name scraped from the page ("Listed by" markup or listingAgentName).
- Field propertyTypeName (string): belowTheFold publicRecordsInfo.basicInfo.propertyTypeName (for example "Single Family Residential").
- Field totalSqft (number): publicRecordsInfo.basicInfo.totalSqFt.
- Field history (array): belowTheFold propertyHistoryInfo.events mapped to {date (ISO from eventDate ms), event (eventDescription), price, source}.
- Field openHouses (integer): count of atf.openHouseInfo.openHouseList.
- Field radiusOk (boolean): true when the gis radius search ran without gisError.
- Field similarActive (array, up to 60): active competition; radius rows sorted by (distance ascending, score descending) when radiusOk, otherwise Redfin "similar listings".
- Field similarSold (array, up to 40): closed sales; radius rows sorted by score descending when radiusOk, otherwise Redfin "similar solds".
- Field bestComps (array, up to 5): the first five sold comps that have sqft, in score order.
- Field radius (object): {half: stats within 0.5 mi, one: stats within 1.0 mi}; each stats object has activeCount, newer, cheaper, activeMedianPrice, activeMedianPpsf, activeMedianDom, soldCount, soldMedianPrice, soldMedianPpsf, soldMedianDom, soldLowPpsf, soldHighPpsf.
- Field newerCompetitors (integer): radius.one.newer (actives with dom lower than the subject's dom).
- Field cheaperCompetitors (integer): radius.one.cheaper (actives priced below currentPrice).
- Field activeMedianPrice, activeMedianPpsf, activeMedianDom, soldMedianPpsf, soldMedianPrice, soldMedianDom: copies of radius.one values.
- Field bestCompPpsf (integer or null): score-weighted mean $/sqft of the bestComps that have ppsf.
- Field bestCompValue (integer or null): bestCompPpsf times subject sqft (sqft or totalSqft).
- Field thumbs: removed from the listing document by seed_db.py and moved to photos/<dealId>; thumbCount (integer) records how many were moved.
- Field carriedFrom (ISO date): present when this week's Redfin pull failed and the previous week's block was carried forward.
- Field carryReason (string): the error that triggered the carry (for example "address not found on Redfin") or "no fresh pull".

### Comp entry fields (similarActive, similarSold, bestComps)
- Radius-search entries have source "radius" with fields address, city, zip, price (int), sqft (int), ppsf (int; from "$/SQUARE FEET" or price/sqft), beds, baths, lot, yearBuilt, dom, hoa, propertyType, mlsStatus, status (1 active, 4 sold), soldDate (ISO parsed from "%B-%d-%Y", "%m/%d/%Y" or "%Y-%m-%d"), url, mls, lat, lng, distance (miles, 2 decimals), isRedfin ("redfin" in SOURCE column), score.
- Redfin "similar" entries have source "similar" with fields address (streetLine plus unit), city, zip, price, sqft, ppsf, beds, baths, dom, status (searchStatus), soldDate (only when searchStatus is 4 or 5), url, propertyId, isRedfin, distance null.

### listings.history[] entries
- Field asOf (ISO date): the snapshot date.
- Field dom (integer or null): days on market that week.
- Field price (integer or null): currentPrice that week.
- Field estimate (integer or null): redfinEstimate that week.
- Field tier (string): tier that week.
- Field hot (boolean): hotHome that week.
- Field priceDrop (boolean): priceDrop that week.
- Field status (string): sheet status that week.
- Field newerCompetitors (integer or null): redfin.newerCompetitors that week (pipeline only; null when Redfin data was carried or missing).
- Field photoCount (integer or null): redfin.photoCount that week (pipeline only).
- Entries are merged from the previous week's document (--prev-db) or previous snapshot (--prev), any entry with the same asOf is replaced, and the list is cut to the last 26.
- The page's upload tab appends the same entry without newerCompetitors and photoCount.

## photos/<dealId>
- The document id is the Deal Id; it is written by seed_db.py only for listings that have thumbnails.
- Field dealId (string), asOf (ISO date), thumbs (array).
- Each thumb has src (a data:image/jpeg;base64 URI), w and h (pixel size of the embedded image), brightness (mean gray level 0 to 255, 1 decimal), darkShare (share of pixels with gray under 50, 3 decimals), brightShare (share of pixels with gray 205 and above, 3 decimals), origW and origH (Redfin's reported photo size).
- fetch_listings.py fetches up to PHOTO_TARGET = 15 photos; the first is encoded at width 560 quality 72, the rest at width 220 quality 60; seed_db.py re-encodes the first 15 to width 480 quality 66 for the first and width 200 quality 54 for the rest.
- README.md says "up to 8 thumbnails" but the code caps at 15 (the initial pull takes 8, the incremental stage fills to 15).
- A photo document is skipped from the push batches when the previous week's photo document had the same number of thumbs.
- When Redfin data is carried forward, the previous week's photo document is reused unchanged.

## coaching/<dealId>
- The document id is the Deal Id; it is written only by the page (writeCoaching merges a patch and sets dealId and updatedAt).
- A write fails with the message "you need Contributor access to save for the team" on error code invalid_argument, "the database is full" on quota_exceeded, otherwise "a temporary error, try again"; without a database the page toasts "Saved on this device only".
- Field dealId (string) and updatedAt (ISO datetime).
- Field engagement (array): entries {date (YYYY-MM-DD), views, favorites, xouts, tours, offers (numbers or null), by (user id or null), at (ISO datetime)}; adding an entry replaces any existing entry with the same date; at least views or favorites is required.
- Field plan (object): {moves (array of move ids), band ("conservative", "intermediate", "aggressive" or ""), targetPrice (number or null), owner (string), due (YYYY-MM-DD or ""), status ("planned", "in progress", "done" or "seller declined"), notes (string), mortgage (number or null), updatedAt, by}.
- Field notes (array): {text, at (ISO datetime), by (user id or null), name ("" at write; the page resolves names from ids when rendering, see gaps)}.
- Field compNotes (string): the "Your comps and notes" textarea, saved on change.
- Field ai (object): Claude's output with headline, diagnosis (array), pricing, photoNotes, remarksRewrite, rocketAngle, moves (array of ids), slackPost, emailSubject, emailBody, sellerGuide, plus at (ISO datetime) and by.
- Field shareouts (object): manual edits to slack, email, subject, seller texts; cleared for slack/email/subject/seller when AI feedback is regenerated.
- Field sent (array): {channel ("slack", "email", "pdf", "spreadsheet"), at (ISO datetime), by}.
- Field studio (object): {audience ("agent", "seller", "team"), sections (map of key to {title, body, on}), order (array of section keys), title, preparedFor, preparedBy, tag, photoCount (0, 6, 11 or 15; default 11), bands ({conservative, intermediate, aggressive} booleans, default all true), objections (array of objection ids or null), compsOn (boolean, default true), updatedAt, saveState ({ok, at, reason})}.

## meta/current
- The document id is "current"; it is written by seed_db.py and by the page's Weekly upload tab.
- Field asOf (ISO date): the snapshot week.
- Field count (integer): number of listings.
- Field tiers (object): {watch, stale, ultra, extreme, unknown} counts.
- Field prevAsOf (ISO date or null): previous snapshot date.
- Field prevCount (integer or null): previous listing count.
- Field prevTiers (object or null): previous tier counts.
- Field changes (object): {newStale, newUltra, newExtreme, priceDrops, gone, added} arrays of Deal Ids.
- Field enrichment (string): "complete" from the pipeline, "pending" from the page upload.
- Field enriched (integer): pipeline only, count of listings with redfin.ok.
- Field carried (integer): pipeline only, count of listings whose Redfin block was carried forward.
- Field unresolved (array): pipeline only, Deal Ids whose redfin.ok is false.
- Field updatedAt (ISO datetime): page upload only.
- The page shows "enrichment pending" in the header when enrichment is "pending".

## weeks/<date>
- The document id is the snapshot date (asOf); it is written by seed_db.py.
- Field asOf (ISO date).
- Field active (integer): number of records.
- Field tiers (object): tier counts.
- Field stale60 (integer): records with (dom or 0) >= 60.
- Field stale60Pct (number): round(stale60 / max(active,1) * 100, 1).
- Field stale30 (integer): records with (dom or 0) >= 30.
- Field stale30Pct (number): round(stale30 / max(active,1) * 100, 1).
- Field volume (integer): sum of currentPrice across all records.
- Field staleVolume (integer): sum of currentPrice across stale30 records.
- Field avgDom (number): mean dom over records with a dom, 1 decimal.
- Field medianDom (integer or null): sorted doms at index len // 2.
- Field priceDrops (integer): records with priceDrop true.
- Field hot (integer): records with hotHome true.
- Field added, gone, newStale, newUltra, newExtreme, weekPriceDrops (integers): lengths of the change lists.
- Field agents (integer): number of distinct agent names.
- Field expiring45 (integer): records with 0 <= daysToExpiration <= 45.
- The page keeps all week documents sorted by asOf and uses the last four for trends.

## openhouses/<dealId>
- The document id is the sheet's Deal ID; it is written by pipeline/openhouse.py (all previous documents in the folder are deleted and rewritten each run).
- Field dealId (string), asOf (the listing week's meta asOf), sheetDate (date parsed from the csv filename, else --sheet-date, else asOf).
- Field market (string): forward-filled "Business Market" (for example "Los Angeles").
- Field agent (string): forward-filled "Deal Agent Name".
- Field agentRole (string): forward-filled "Deal Agent Role" (for example "Agent").
- Field address (string): from the sheet; when empty and the deal is active it is "<listing address>, <listing city>".
- Field dealUrl (string): from the sheet, else "https://www.redfin.com/tools/deals/sell/<dealId>".
- Field listPrice (number or null): "Listing Price".
- Field commission (number or null): "Redfin Commission".
- Field opens (integer): "Open Houses".
- Field normOpens (integer): "Norm Opens", else NORM_OPENS = 4.
- Field vsNorm (integer): opens - normOpens.
- Field priceDropOpens (integer): "Price Drop Open Houses".
- Field signIns (integer): "Sign Ins".
- Field convertableSignIns (integer): "Convertable Sign Ins" (not rendered by the page).
- Field cost (number): "Estimated OH Costs".
- Field paidOpens (integer): min(opens, round(cost / 165.0)) when cost > 0, else 0; replaced by hosts.associate when the event export has associate-hosted events.
- Field unpaidOpens (integer): max(0, opens - paidOpens).
- Field costPerOpen (number or null): round(cost / opens, 2) when opens > 0.
- Field spendPctCommission (number or null): round(cost / commission * 100, 1) when commission > 0.
- Field paidOpensEstimated (boolean): true unless the event export supplied associate hosts.
- Field associateRate (number): 165.0.
- Field duplicateRows (integer): present when the deal appears more than once in the sheet; opens, priceDropOpens, signIns, convertableSignIns, cost, paidOpens and unpaidOpens are summed across the rows and vsNorm and spendPctCommission recomputed.
- Field active (boolean): true when the Deal ID matches a listing in the week's db folder.
- Fields tier, dom, city, currentPrice, listingAgent: copied from the matching listing when active.
- Field events (array): present when the event export has rows for this deal; entries {date, host, role, signIns, cost (when a cost column exists)}.
- Field hosts (object): {listingAgent, teamAgent, associate, unknown} counts of events by role.
- Field hostNames (object): host name to count of events.

## ohweeks/<date>
- The document id is the listing week's asOf; it is written by openhouse.py as ohweek.json.
- Field asOf, sheetDate.
- Field deals (integer): number of open house documents.
- Field activeDeals (integer): documents with active true.
- Field activeListings (integer): number of listings in the week's db folder.
- Field opens, paidOpens, unpaidOpens (integers): sums over all documents.
- Field cost, commission (numbers, 2 decimals): sums over all documents.
- Field activeOpens, activePaidOpens, activeCost, activeCommission: sums over active documents.
- Field spendPerActiveListing (number): activeCost / max(activeListings, 1), 2 decimals.
- Field spendPerActiveDeal (number): activeCost / max(activeDeals, 1), 2 decimals.
- Field avgOpens (number): opens / max(deals, 1), 1 decimal.
- Field aboveNorm (integer): documents with vsNorm > 0.
- Field priceDropOpens (integer): sum.
- Field highSpend10 (integer): documents with spendPctCommission >= 10.
- Field associateOnly (integer): documents with opens >= 3 and paidOpens >= opens.
- Field stale60NoRecord (integer) and stale60NoRecordIds (array): active listings with dom >= 60 whose Deal Id is not in the sheet.
- Field duplicates (integer): documents with duplicateRows.
- Field byTier (object): keyed by tier for active deals and "inactive" for the rest, each {deals, opens, paidOpens, cost, commission}.
- Field eventsLoaded (boolean), associateRate (165.0), normOpens (4).

## earlyaccess/<propertyId>
- The document id is the Redfin property id (or the "x<digits>" fallback for sheet homes without a Redfin URL); it is written by pipeline/early_access.py (the folder is cleared and rewritten each run).
- Sheet-sourced documents carry source "sheet"; crawled documents carry source "redfin.com".
- Field propertyId (string), url (string), address (street), unit (crawled only), city, zip, state ("CA" for sheet homes), price, beds, baths, sqft, pricePerSqft (round(price / sqft) for sheet homes; Redfin's value for crawled homes).
- Field marketLabel (sheet MARKET column) and description (sheet DESCRIPTION column): sheet homes only; not rendered by the page.
- Field sheetDate (sheet homes only): date parsed from the exclusives filename, else today.
- Field stage (string): "exclusive", "redfin", "other" or "live".
- Field badge (string): "REDFIN EXCLUSIVE" for exclusives, "REDFIN COMING SOON" for Redfin coming soon, the brokerage sash name (for example "COLDWELL BANKER REALTY COMING SOON") or "COMING SOON" for other brokerages.
- Field brokerageBadge (string or null): the sash 47 name for crawled homes.
- Field redfinCheck (object, sheet homes with a numeric property id): {redfinStatus, source, searchStatus, beds, baths, sqft, yearBuilt, lotSize, lat, lng, lastSoldPrice, lastSoldDate, isRedfin, propertyTypeId, zip, city, publicStage ("live", "comingsoon" or "offmarket"), error}.
- Fields lat, lng, yearBuilt, lotSize, lastSoldPrice, lastSoldDate: copied from redfinCheck when present (sheet homes), or from the crawl.
- Field dealId (string): the active listing's Deal Id when the normalized address matches a listing this week.
- Field listingAgent (string): the listing's agent for a sheet home that graduated, or Redfin's listingAgent name for a crawled home (filled from the listing page when the crawl lacked it).
- Field listingAgentSheet (string): crawled home only, the active listing's agent when the address matched a listing.
- Fields dom and tier: copied from the matching listing for graduated sheet homes; dom for crawled homes is Redfin's dom or round(timeOnRedfin / 86400000).
- Field graduated (object): {to: "MLS active" | "Redfin.com shows <status>" | "Early Access coming soon on Redfin.com", dealId, dom}.
- Crawled-only fields: listingId, propertyType, uiPropertyType, timeOnRedfin, numPictures, remarks, remarksAccessLevel, isRedfin, isEarlyAccess, earlyAccessType, county, mlsId, openHouse (openHouseStartFormatted), hasVideoTour, has3DTour, photoError.
- Field thumbs (array, up to 6): same thumb shape as photos; sheet homes get thumbs from aboveTheFold when stage is not live and --no-photos is not set, trimmed of black letterbox bars; crawled Redfin coming-soon homes get thumbs from aboveTheFold; other-brokerage homes get no thumbs.
- Field area (string): "Los Angeles County", "Ventura County", "Orange County", "Central Coast" or "Other" from the zip (see section 10).
- Field asOf (listing week) and checkedAt (today's date when the script ran).
- Field firstSeen (ISO date): carried from last week's document, else sheetDate for sheet homes, else today.
- Field stageChangedFrom (string) and stageChangedAt (ISO date): set when the stage differs from last week; otherwise stageChangedAt carries over or equals firstSeen.
- Field daysInEarlyAccess (integer): today minus firstSeen in days.
- Fields daysUsed, daysLeft, clock: only for stages "redfin" and "other" (see section 10).
- Field nearbyCities (array of up to 5 city names).
- Field fingerprint (object): {priceMin, priceMax, bedsMin, bathsMin, cities (array), type}.
- Field features (array of strings) from the remarks regex list.

## eaweeks/<date>
- The document id is the listing week's asOf; written by early_access.py as eaweek.json.
- Field asOf, checkedAt, sheetDate.
- Field total (integer): number of Early Access documents (including live).
- Field byStage (object): stage to {count, volume (sum of price), laCount (count in "Los Angeles County")}.
- Field exclusives, redfinComingSoon, otherComingSoon, graduated (integers): counts by stage exclusive, redfin, other, live.
- Field preMarketVolume (number): sum of price for stages exclusive and redfin.
- Field newThisWeek (array): property ids not in last week's documents and not stage live.
- Field gone (array): last week's property ids missing this week.
- Field byArea (object): area name to count.
- Field eaDays (integer): 21.

## eameta/<propertyId>
- The document id is the property id; written only by the page (writeEaMeta merges a patch and sets propertyId and updatedAt).
- Field agent (string): the editable listing agent typed on an expanded card.
- Field copies (object): prompt key ("find", "outreach", "listing", "team", "text", "email") to copy count.
- Field tally (object): {matches, outreach, showings, offers} running totals.
- Field feedback (array, last 30): {at, by, name, text}.
- Field log (array, last 40): {at, by, name, type ("copy" or "log"), what (the prompt label, or "<n> matches, <n> outreach…" or "feedback")}.
- Field updatedAt (ISO datetime).

## market/current
- The document id is "current"; the file data/market.json is pushed by Claude (seed_db.py copies it into the week folder and the manifest).
- Field asOf (string, "2026-10-07").
- Field rates (object): rate30 7.28, rate15 6.60, rate30_1wk 7.03, rate30_1mo 6.71, rate30_3mo 6.43, rate30_6mo 6.46, rate30_12mo 6.34, rate30_2026low 5.98, asOf "week of Oct 1, 2026", source "Freddie Mac PMMS", url, jumbo 7.27, note.
- Field narrative (string): the long market narrative rendered on the Market tab.
- Field talkingPoints (object): arrays keyed under750, 750to1500, 1500to3000, over3000.
- Field stats (array): {metric, geo, value, period, source}; 25 entries.
- Field affordability (array): {price, pi728, pi678, pi778}; not rendered by the page.
- Field news (array of strings): not rendered by the page.
- Field driftPctPerMonth (-0.4): not read by the page (the page has its own default driftPct -0.4).
- Field notFound (array): not rendered by the page.
- The page sets S.a.rate to market.rates.rate30 when the viewer has no saved assumptions in localStorage.

## playbook/current
- The document id is "current"; the file data/playbook.json is pushed by Claude.
- Field version ("2026-10-07b") and intro: not rendered.
- Field moves (array of 21): {id, label, desc, group}; overrides the page's DEFAULT_MOVES when non-empty.
- Field diagnostics (array of 8): {cause, signals, fix}.
- Field tierPlays (object): watch, stale, ultra, extreme each {title, goal, steps, rules}.
- Field pricing (array of 8 strings).
- Field relaunch (array of 7 strings).
- Field photoRubric (array of 10 {item, standard}): not rendered by the page.
- Field scripts (array of 7 {title, text, source}).
- Field stats (array of 17 {stat, source, url}).
- Field financing (array of 4 strings): not rendered by the page.
- Field coach (object): principle, bottomLine, drivers{price, presentation, perception, process each {label, desc, line, sellerLine, question}}, tests[] {name, ask[]}, paths{A,B,C,D each {label, driver, steps[]}}, steps[], photoRules[], staging[], pricing[], buyerObjections[], buyerNeeds[], marketReality[], questions[], scripts{opening, price, presentation, relaunch, urgency, alignment}, objections[] {id, say, respond, coach[]}, sellerGuidance{whatsHappening, goal, buyersRespondTo[], whyItMatters, howWeThink[], honest}, sellerChecklist{before[], closing[]}, firmLines[], earlyAccess[].
- The page falls back to an embedded COACH_DEFAULT (identical content) when playbook.coach is missing.

# 3. Stale definition and tiers

- Days on market is read from the sheet column "Days On Mkt" and stored as dom; it is an integer only when the value is all digits, otherwise null.
- The page never recomputes dom from dates; the sheet value is authoritative.
- Redfin's cumulativeDaysOnMarket is stored separately as redfin.cumulativeDom and shown in the property header as "(Redfin shows N cumulative)" when it differs from dom.
- The tier function is identical in fetch_listings.py (tier) and the page (tierOf): dom null -> "unknown"; dom >= 90 -> "extreme"; dom >= 60 -> "ultra"; dom >= 30 -> "stale"; otherwise "watch".
- Tier "watch" is labelled "Watch", icon ◔, order 0, min 0; posture per README: 1 to 29 days, protect the launch window, log traffic weekly.
- Tier "stale" is labelled "Stale", icon ◑, order 1, min 30; posture: 30 to 59 days, diagnose, fix non-price causes, one decisive move before day 60.
- Tier "ultra" is labelled "Ultra Stale", icon ◕, order 2, min 60; posture: 60 to 89 days, second launch: reprice 7 to 10%, new media, financing play.
- Tier "extreme" is labelled "Extremely Stale", icon ●, order 3, min 90; posture: 90+ days, full reset meeting: new band, withdraw and relist, or pause.
- Tier "unknown" is labelled "No DOM", icon ○, order -1, min 0, and means the sheet row had no numeric Days On Mkt.
- The playbook intro states "Redfin defines a stale listing as 60+ days without a contract."
- A listing is "stale or worse" in the page when its tier is stale, ultra or extreme (used for Stale volume, Avg gap, the agents table and the 90-day cost of waiting KPI).
- "Stale 60+" (Redfin definition) counts listings with (dom or 0) >= 60; the weekly KPI is stale60 and the share is stale60Pct = stale60 / active * 100 (page: stale60 / arr.length * 100, 1 decimal).
- "Aging 30+" (dashboard tiers) counts listings with (dom or 0) >= 30; the weekly KPI is stale30 and stale30Pct.
- The weekly table labels these rows "Stale 60+ (Redfin definition)", "Stale 60+ share" and "Aging 30+ (dashboard tiers)".
- The Overview's "Stale listings · 60+" tile opens the Listings tab filtered to tiers ultra and extreme.
- Tier colors are --t-watch #5b6470, --t-stale #b07a0a, --t-ultra #d0582d, --t-extreme #c3242f in light mode and #bcc5d1, #ffc85c, #ff9b6e, #ff7c87 in dark mode.
- The price band function is identical in the pipeline and the page: price missing -> "unknown"; price < 750000 -> "under750"; price < 1500000 -> "750to1500"; price < 3000000 -> "1500to3000"; otherwise "over3000".
- Band labels are "Under $750K", "$750K to $1.5M", "$1.5M to $3M", "$3M+" and "No price".
- Overview histogram bins for days on market are 0–14, 15–29, 30–44, 45–59, 60–74, 75–89, 90–119, 120–179 and 180+ and each bar is colored by the tier of the bin's lower bound.

# 4. Week-over-week change rules

- seed_db.py compares each record to the previous week's document (from --prev-db, preferred, or --prev snapshot) keyed by dealId.
- newStale: previous tier was "watch" and new tier is "stale".
- newUltra: previous tier was "watch" or "stale" and new tier is "ultra".
- newExtreme: previous tier was not "extreme" and new tier is "extreme".
- priceDrops (this week): both weeks have a currentPrice and the new currentPrice is lower than the previous one.
- added: the dealId was not in the previous week.
- gone: a previous-week dealId is not in this week's records.
- A listing that jumps straight from watch to extreme counts only as newExtreme (not newStale or newUltra).
- The page's Weekly upload tab applies exactly the same five rules against the listings currently in the database, and computes gone as database ids missing from the sheet.
- The page upload marks each gone listing by rewriting its document with status "Removed from sheet" and removedAt = today, which hides it from the page.
- The pipeline does not rewrite gone listings; the hand-made batch-gone.json sends "update" operations with {status: "Removed from sheet", removedAt: <asOf>} for each id in changes.gone. UNVERIFIED (file author)
- meta.changes carries the six id lists and the Overview renders them as badges "◑ N crossed 30 days", "◕ N crossed 60 days", "● N crossed 90 days", "↓ N price drops", "✓ N left the list", "+ N new listings", plus clip chips for each listing in newExtreme, newUltra, newStale and priceDrops.
- week.json stores the counts as added, gone, newStale, newUltra, newExtreme and weekPriceDrops; the "What moved this week" chart shows New this week, Left the list, Crossed 30 days, Crossed 60 days, Crossed 90 days and Price drops this week with last week's value beside each bar.
- "Listings with a price drop" in the weekly table is week.priceDrops = count of records whose sheet Price Drop? is Y (cumulative, not this week's drops).
- expiring45 in week.json counts records with 0 <= daysToExpiration <= 45.
- The Overview "Expiring within 45 days" card lists listings with daysToExpiration between 0 and 45 inclusive and no dataIssues, sorted by daysToExpiration ascending, first 6 shown with "<n>d", address, agent, tier badge, dom and the expiration date.
- The analysis flag "expiring" uses daysToExpiration <= 45 with no lower bound, so already-expired listings also carry the flag.
- The Overview "Tier mix" legend shows "(+N wk)" deltas against meta.prevTiers for each tier.
- kpiTrend tiles compute the delta as the current week's value minus the previous week's value (rounded to 1 decimal) and the percent change against the previous week; a rise is red when opts.badUp is set, green when opts.goodUp is set, otherwise foreground color; zero is gray.

# 5. Derived listing metrics and every formula

## Sheet-derived (pipeline shape() and page upload)
- daysToExpiration = expirationDate - asOf in whole days.
- gapToEstimatePct = round((currentPrice - redfinEstimate) / redfinEstimate * 100, 1), null unless both are truthy.
- gapToPredictedPct = round((currentPrice - predictedClose) / predictedClose * 100, 1), null unless both are truthy.
- reductionPct = round((originalPrice - currentPrice) / originalPrice * 100, 1) when originalPrice > currentPrice, else 0.0; shown on the property page as "Original · cut N%".
- The page's "Price" column shows "↓ $NK" under the price when priceDrop is true, using priceDropAmt.

## Value anchors (page function anchors(l))
- sqft = redfin.sqft or redfin.totalSqft.
- estimate = listing.redfinEstimate (sheet) if present, else round(redfin.estimate) (Redfin.com AVM).
- predicted = listing.predictedClose.
- compSold = redfin.bestCompValue if present, else round(redfin.soldMedianPpsf * sqft) when both exist.
- compActive = round(redfin.activeMedianPpsf * sqft) when both exist (computed but not used elsewhere).
- compLow = round(radiusStats.soldLowPpsf * sqft) and compHigh = round(radiusStats.soldHighPpsf * sqft) using the currently selected radius.
- marketValue ("blended market value") = median of the non-zero values among [estimate, predicted, compSold]; with two values it is the rounded mean of the two; with none it is null.
- gapMV = (currentPrice - marketValue) / marketValue * 100 ("vs market", "Gap to blended market value").

## Radius search and comps (fetch_listings.py)
- The radius search is Redfin's /stingray/api/gis-csv inside a square of ±1.0 mile around the subject: dlat = miles / 69.0 and dlon = miles / (69.0 * cos(lat)); the polygon is the four corners closed back to the first.
- Common query parameters: al=1, market=socal, num_homes=350, ord=redfin-recommended-asc, page_number=1, v=8, include_nearby_homes=true, mpt=99.
- Active search uses status=1 with sf=1,2,3,5,6,7 and uipt=1,2,3,4,5,6,7,8.
- Sold search uses status=9 with sold_within_days=180.
- A leading "In accordance" disclaimer line in the CSV response is dropped before parsing; rows without LATITUDE are skipped.
- Distance uses the haversine formula with Earth radius 3958.8 miles, rounded to 2 decimals.
- Radius rows are kept only when distance is not null and <= 1.0, price is truthy, and the subject's own Redfin URL is not contained in the row's URL.
- comp_score starts at 100.0 and subtracts: min(40, |comp sqft - subject sqft| / subject sqft * 100 * 0.8) when both have sqft, else 15; min(16, |beds diff| * 8); min(10, |baths diff| * 5); min(20, distance * 15); for sold comps with a sold date, min(20, age_days / 30 * 2.5); 15 when one is a Condo and the other is not, or one is a Townhouse and the other is not (by propertyTypeName vs propertyType strings); min(10, |yearBuilt diff| / 10); the result is max(0, score) rounded to 1 decimal.
- Actives are sorted by (distance ascending, score descending); solds by score descending; when the radius search failed (radiusOk false) Redfin's "similar listings"/"similar solds" are used instead.
- similarActive keeps the first 60, similarSold the first 40, bestComps the first 5 solds that have sqft.
- stats(actives, solds) computes activeCount; newer = actives with a dom lower than the subject's dom (subject dom defaults to 0); cheaper = actives with price below the subject's currentPrice; activeMedianPrice, activeMedianPpsf, activeMedianDom, soldMedianPrice, soldMedianPpsf, soldMedianDom as the element at index len // 2 of the sorted list; soldLowPpsf = sorted sold ppsf at index len // 4; soldHighPpsf = sorted sold ppsf at index min(len - 1, 3 * len // 4).
- radius.half applies stats to rows with distance <= 0.5; radius.one to all rows.
- bestCompPpsf = round(sum(ppsf * score) / sum(score)) over bestComps that have ppsf; bestCompValue = int(bestCompPpsf * subject sqft).
- The page radius toggle (0.5 mi or 1 mi, default 1.0) selects radius.half or radius.one (radiusStats) and filters similarActive/similarSold to distance <= radius (nearby); comps with null distance are always included.
- newComps(l) = similarActive entries with dom <= 30 and within the radius, sorted by distance ("New competition in the last 30 days").
- Price per square foot for the subject is redfin.pricePerSqft from Redfin's addressSectionInfo (the page does not recompute it from currentPrice).

## Timing and reductions
- Days since the last reduction (sinceCut) = daysBetween(lastReductionDate, listing.asOf or today); the page's daysBetween uses noon-anchored dates and rounds.
- "Cut has worn off" triggers when sinceCut > 45.
- "Small cut" triggers when priceDropAmt / originalPrice < 0.02.
- Agreement days left is daysToExpiration; "expiring" triggers at <= 45 and is high severity at <= 21.

## Traffic (coaching.engagement)
- The latest engagement entry is the one with the greatest date; the previous entry is the second greatest.
- Favorites ratio = favorites / views (shown as a percent next to Favorites on the property page).
- "Traffic falling" triggers when the previous entry has views and current views < previous views * 0.7.
- "Look but do not save" triggers when views >= 200 and ratio < 0.02 (evidence says a healthy listing saves at 3% to 5%).
- "Save but do not tour" triggers when favorites >= 15 and tours <= 1.
- Listings in a non-watch tier with no engagement entries get the flag "no-engagement-data".

## Photo norms
- photoCount < 18 flags the photo set; the evidence text says "top listings in this band run 25 to 40".
- lowResPhotos > 0 (any photo narrower than 1024 px) flags the photo set.
- The lead photo reads dark when thumbs[0].darkShare > 0.35.
- The property page shows the lead photo's brightness "/255", dark share as a percent, source size origW×origH and low-res frame count.
- The playbook photoRubric standard is 25+ photos (Zillow average 33) but the page's numeric threshold is 18.

## Remarks flags
- Remarks are flagged when length < 450 characters, or the share of capital letters among letters > 0.5, or the remarks do not match /offer|credit|buydown|incentive|motivated|priced to|reduced|new price|rate/i.
- Perception keywords (regex, label): /hillside|hill side|canyon|slope/i "hillside"; /fire zone|fire area|very high fire|wildfire/i "fire-zone framing"; /\balley\b|rear access/i "alley or rear access"; /busy street|main street|boulevard|freeway|highway/i "traffic or freeway exposure"; /power lines|transmission/i "power lines"; /unpermitted|non-permitted|as-is/i "permit or as-is language"; /flag lot|easement|shared driveway/i "access or easement".
- A propertyTypeName matching /Condo|Townhouse/i adds the perception hit "condo financing and HOA questions"; one matching /Vacant Land|Land|Lot/i adds "land: a narrow, cautious buyer pool".
- A Redfin history event matching /relist/i sets the "relisted" flag.

## Payment math (page)
- payment(price, rate = S.a.rate, down = S.a.down): P = price * (1 - down / 100); r = rate / 100 / 12; n = 360; payment = P * r / (1 - (1 + r)^-n); returns 0 when P or r is 0.
- priceForPayment(pay, rate, down): P = pay * (1 - (1 + r)^-n) / r with n = 360; price = P / (1 - down / 100).
- buydownCost(price) = (p0 - p1) * 12 + (p0 - p2) * 12 where p0 = payment at the current rate, p1 = payment at rate - 2, p2 = payment at rate - 1 (the seller cost of a 2-1 buydown).
- roundPrice(p) rounds to the nearest 25000 when p >= 2000000, 10000 when p >= 1000000, else 5000.
- Search brackets checked for the pricing paths are 500000, 750000, 1000000, 1250000, 1500000, 2000000, 2500000, 3000000, 4000000, 5000000; a path "lands on" a bracket when |price - bracket| / bracket < 0.02.
- fmt$ with {k:true} prints values >= 1,000,000 as "$X.XXM" (1 decimal when >= 10,000,000, trailing zeros trimmed) and values >= 1000 as "$NK".

# 6. Health score

- healthScore (A.score) starts at 100 and subtracts the tier penalty: watch 0, stale 15, ultra 28, extreme 40, unknown 10.
- Overpriced: when gapMV > 3, subtract 18 when gapMV > 8 else 10 (flag "overpriced").
- Slightly above market: else when gapMV > 0 and tier is not watch, subtract 4 (no flag).
- The following apply only when redfin.ok is true.
- Price per square foot above the active median: when redfin.pricePerSqft > redfin.activeMedianPpsf * 1.05, subtract 6 (flag "ppsf-high").
- Competition: when newerCompetitors >= 3 or cheaperCompetitors >= 3, subtract 8 (flag "competition").
- Photos: when photoCount < 18 or lowResPhotos > 0 or lead photo darkShare > 0.35, subtract 7 (flag "photos").
- Remarks: when remarks length < 450 or capitals share > 0.5 or no incentive keyword, subtract 5 (flag "remarks").
- Not a Hot Home and tier is not watch: subtract 3 (no flag).
- No open house scheduled on Redfin and tier is not watch: subtract 3 (flag "no-open").
- Relisted: no score change, flag "relisted" and a diagnosis.
- When redfin.ok is false and dataIssues is non-empty, flag "data" (no score change).
- The following apply only when the tier is not watch.
- No price reduction (priceDrop false): subtract 10 (flag "no-reduction").
- Else when sinceCut > 45: subtract 6 (flag "stale-reduction").
- Small cut (priceDrop true, priceDropAmt / originalPrice < 0.02): subtract 4 (flag "small-cut").
- Expiring (daysToExpiration <= 45, any tier): subtract 5 (flag "expiring").
- Traffic falling: subtract 5 (flag "traffic-down").
- Else look but do not save: subtract 5 (flag "looking-not-saving").
- Else save but do not tour: subtract 4 (flag "saving-not-touring").
- No plan on file (no coaching.plan.moves) and tier not watch: subtract 5 (flag "no-plan").
- Perception hits (redfin.ok): subtract 4 (flag "perception").
- Open house spend alert (oh-spend): subtract 6 (flag "oh-spend").
- Else open house above norm and tier not watch: subtract 3 (flag "oh-above-norm").
- Open house associate-only: subtract 3 (flag "oh-associate").
- Open house duplicate rows: flag "oh-duplicate", no score change.
- No open house record while dom >= 60 and the open house sheet is loaded: subtract 4 (flag "oh-none").
- The score is clamped to 0..100 and rounded.
- There are no bonuses; the score only decreases from 100.
- Score colors: >= 70 green (--good), >= 45 amber (--t-stale), otherwise red (--t-extreme); used by the Listings health meter, the property header card and the health meter bar.
- priority = round((100 - score) * (1 + min((currentPrice or 500000) / 2000000, 1.5))); it ranks the Overview queue and is the default Listings sort.
- The Overview queue "Needs attention this week" lists the top 10 non-watch listings by priority descending.

# 7. Diagnosis engine

## Findings (each has a cause, trigger, evidence template, severity and recommended move codes)
- Cause "Priced above what the market is saying": trigger gapMV > 3; severity "high" when gapMV > 8 else "med"; evidence "List price is {pct(gapMV)} above the blended market value of {marketValue} (Redfin Estimate {estimate}, predicted close {predicted}[, sold comps {compSold}])."; moves PRICE_ADJUST, SELLER_CONVERSATION; driver price.
- Cause "Slightly above market with no urgency signal": trigger gapMV > 0 and gapMV <= 3 and tier not watch; severity "low"; evidence "List price sits {pct(gapMV)} above blended market value. At {dom} days, buyers read that as room to wait."; moves PRICE_BRACKET, RATE_BUYDOWN; driver falls to "process" because no driver regex matches the cause text.
- Cause "Price per square foot is above the active competition": trigger redfin.ok and pricePerSqft > activeMedianPpsf * 1.05; severity "med"; evidence "{pricePerSqft}/sqft versus a {activeMedianPpsf}/sqft median across {similarActive.length} similar actives[; recent solds closed near {soldMedianPpsf}/sqft]."; moves PRICE_ADJUST; driver price.
- Cause "Fresher and cheaper competition came on after this listing": trigger newerCompetitors >= 3 or cheaperCompetitors >= 3; severity "high" when newerCompetitors >= 6 or cheaperCompetitors >= 5 else "med"; evidence "{newerCompetitors} similar homes listed after this one and {cheaperCompetitors} are priced lower. Buyers in this band see those first."; moves PRICE_ADJUST, PHOTO_REFRESH, RATE_BUYDOWN; driver price.
- Cause "Photo set is not pulling its weight": trigger photoCount < 18 or lowResPhotos > 0 or lead darkShare > 0.35; severity "med"; evidence joins with "; " the applicable bits "only {photoCount} photos (top listings in this band run 25 to 40)", "{lowResPhotos} low resolution frames", "the lead photo reads dark" and ends with "."; moves PHOTO_REFRESH, TWILIGHT_VIDEO; driver presentation.
- Cause "Remarks describe the house but do not sell the deal": trigger remarks length < 450 or capitals share > 0.5 or no incentive keyword; severity "low"; evidence joins "remarks are short ({length} characters)", "written mostly in capitals", "no incentive, pricing or financing hook for a buyer to act on"; moves REMARKS_REWRITE, BUYER_INCENTIVE; driver presentation.
- Cause "Already relisted once without a visible change": trigger a Redfin history event matching /relist/i; severity "med"; evidence "Redfin shows a relist event and still displays cumulative days on market, so a reset alone did not help. The next move has to be a real change buyers can see."; moves PRICE_ADJUST, PHOTO_REFRESH, REMARKS_REWRITE; driver presentation.
- Cause "No price response to market feedback": trigger tier not watch and priceDrop false; severity "high" when tier is extreme else "med"; evidence "{dom} days without a reduction. The market has voted every week and the listing has not answered."; moves SELLER_CONVERSATION, PRICE_ADJUST; driver price.
- Cause "Last reduction has worn off": trigger tier not watch, priceDrop true and sinceCut > 45; severity "med"; evidence "Last price change was {sinceCut} days ago. A reduction buys roughly two to three weeks of renewed attention and this one is spent."; moves PRICE_ADJUST, RELAUNCH; driver price.
- Cause "Reductions have been too small to re-rank the home": trigger tier not watch, priceDrop true, priceDropAmt / originalPrice < 0.02; severity "low"; evidence "Total reduction is {pct}% of the original price. Buyers do not refresh their search for a sub-2% change."; moves PRICE_BRACKET, PRICE_ADJUST; driver price.
- Cause "Listing agreement is close to expiring": trigger daysToExpiration <= 45; severity "high" when <= 21 else "med"; evidence "{daysToExpiration} days to expiration ({expirationDate}). Agree the relaunch plan and the extension in the same conversation."; moves EXPIRATION_PLAN, SELLER_CONVERSATION; driver process.
- Cause "Online traffic is falling week over week": trigger previous views exist and current views < previous views * 0.7; severity "med"; evidence "Views dropped from {prev views} to {views}; favorites {prev favorites} to {favorites}. Fewer buyers are even looking."; moves PRICE_ADJUST, PHOTO_REFRESH, SOCIAL_PUSH; driver process.
- Cause "Buyers look but do not save": trigger views >= 200 and favorites / views < 0.02; severity "med"; evidence "{views} views and only {favorites} favorites ({ratio}%). A healthy listing in this band saves at 3% to 5%. That pattern is price or photos."; moves PRICE_ADJUST, PHOTO_REFRESH; driver presentation.
- Cause "Buyers save it but do not tour": trigger favorites >= 15 and tours <= 1; severity "low"; evidence "{favorites} favorites and {tours} tours. Interest exists; access, price anchoring or an incentive is the missing nudge."; moves SHOWING_ACCESS, RATE_BUYDOWN, OPEN_HOUSE_BLITZ; driver process.
- Cause "No action plan on file": trigger no coaching.plan.moves and tier not watch; severity "low"; evidence "Nothing is logged for this listing yet. Pick the moves below, assign an owner and a date."; moves SELLER_CONVERSATION; driver process.
- Cause "Buyers may be reacting to perception, not the house": trigger redfin.ok and at least one perception keyword or property-type hit; severity "med" when more than one hit else "low"; evidence "Signals in the listing itself: {hits joined by ', '}. Street view, aerials and neighborhood labeling decide whether a buyer clicks in or clicks away."; moves PHOTO_REFRESH, REMARKS_REWRITE; driver perception (preset).
- Cause "Open house spend is outrunning the commission": trigger the oh-spend alert; severity "med"; evidence "{opens} open houses in the trailing six months, about {paidOpens} hosted by paid associates: {cost} of estimated cost, {spendPct}% of the {commission} Redfin commission. Exposure has been tried repeatedly without an offer, which points at price."; moves PRICE_ADJUST, SELLER_CONVERSATION; driver price (preset).
- Cause "Already past the open house norm": trigger the oh-above-norm alert without oh-spend and tier not watch; severity "low"; evidence "{opens} opens against a norm of {norm}[, {priceDropOpens} of them after a price drop]. The buyers who were going to walk in have walked in; the next open needs a new price or a new story."; moves PRICE_ADJUST, REMARKS_REWRITE; driver price (preset).
- Cause "Listing agent has not hosted an open house": trigger the oh-associate alert; severity "low"; evidence "{paidOpens} of {opens} opens were hosted by paid associates[ (estimated from the sheet's cost)]. The agent who hosts hears the objections first and brings them to the seller with authority."; moves OPEN_HOUSE_BLITZ, FEEDBACK_LOOP; driver process (preset).
- Cause "No open house record at 60+ days": trigger no openhouses document, dom >= 60 and the open house collection is loaded; severity "med"; evidence "{dom} days on market and this deal is not in the trailing six month open house report, so it has had at most {ohNorm} opens. Book one this weekend with a new price, or document why the seller declined."; moves OPEN_HOUSE_BLITZ, PRICE_ADJUST; driver process (preset).
- When no finding fires the property page shows "No red flags from the data" with "Keep the plan simple: confirm engagement numbers and hold the seller to the review date."

## Ordering, drivers, paths and recommendations
- Findings are sorted by severity: high, then med, then low.
- Each finding without a preset driver gets one from its cause text: /price|per square foot|competition|reduction|re-rank|Reductions/i -> "price"; else /photo|remarks|look but do not save|relisted/i -> "presentation"; else /perception/i -> "perception"; else "process".
- Each finding gets coachNote = coach.drivers[driver].line and coachQuestion = coach.drivers[driver].question.
- Driver scores add severity weights high 3, med 2, low 1 per finding into dScore {price, presentation, perception, process}.
- primaryDriver is the driver with the highest dScore (ties resolved by object key order price, presentation, perception, process because the sort is stable).
- highCount is the number of high findings; multi is the number of drivers with dScore >= 2.
- path = "D" when tier is extreme and (multi >= 2 or highCount >= 2); else "A" when primaryDriver is price; "B" when presentation; "C" when perception; "A" when process.
- Recommended moves (A.rec) are the move codes of every finding in order, de-duplicated; then RATE_BUYDOWN is appended when tier is not watch; RELAUNCH is appended when tier is extreme; FEEDBACK_LOOP is appended when tier is not watch.
- The property page marks recommended moves with a dashed border and a "rec" badge in the plan panel.
- The driver badges on the property page show "{label} ·{dScore}" with the primary driver highlighted.
- The "Recommended path" card shows coach.paths[path].label, the primary driver's desc and line in bold, the path's steps and coach.bottomLine.

# 8. Pricing paths and cost of waiting

## Assumptions (S.a), editable under the ⚙ Assumptions panel
- rate: "30-yr rate %", default 7.28, step 0.01; replaced by market.rates.rate30 at load when localStorage has no "slcc-assump".
- down: "Down payment %", default 20, step 1.
- carryPct: "Carrying cost %/yr", default 1.8, step 0.1.
- driftPct: "Market drift %/mo", default -0.4, step 0.1.
- discStale: "Stale discount %", default 1.5, step 0.5.
- discUltra: "Ultra discount %", default 3, step 0.5.
- discExtreme: "Extreme discount %", default 5, step 0.5.
- urgencyPct: "Reprice urgency premium %", default 0.5, step 0.1.
- closingPct: "Closing costs %", default 6, step 0.5.
- ohNorm: "Open house norm (opens)", default 4, step 1.
- ohRate: "Associate rate per open $", default 165, step 5.
- ohSpendPct: "High OH spend · % of commission", default 10, step 1.
- Every change is stored as JSON under localStorage key "slcc-assump" and re-renders the page; the panel says "used in pricing paths and cost of waiting · saved on this device".
- The panel's inputs have ids "a-<key>" and the panel is prepended to main until Close is clicked.

## Pricing paths (priceBands)
- Pricing paths are computed only when currentPrice exists.
- mv = marketValue or estimate or predicted or price * 0.97.
- gap = max(0, (price - mv) / price).
- highAnchor = max of the positive values among compHigh, estimate, compSold; mv when none.
- consRaw = min(price * (1 - max(0.025, gap / 2)), max(highAnchor, mv)).
- step = 25000 when price >= 2000000, 10000 when price >= 1000000, else 5000.
- Conservative price = roundPrice(min(consRaw, price * 0.975)).
- Intermediate starts at mv; when activeMedianPpsf and sqft exist it becomes min(inter, activeMedianPpsf * sqft * 0.985); then min(inter, price * 0.95, conservative * 0.975); then roundPrice; if it is >= conservative it becomes conservative - step.
- q25 = the price at index floor(n * 0.25) of the sorted active competition prices when n >= 4.
- Aggressive candidates: ("4.5% under blended market value", mv * 0.955); ("8% under today's price", price * 0.92); when compLow exists ("the lower-quartile closed price per foot ({compLow} implied)", compLow * 1.01); when q25 exists ("the bottom quarter of the active competition ({q25})", q25 * 0.995); ("4% under the intermediate path", intermediate * 0.96).
- Aggressive price = roundPrice of the lowest candidate; if it is >= intermediate it becomes intermediate - step; the candidate's label is used in the rationale as aggrWhy.
- Each path records cutAmt = price - pathPrice, cutPct = cutAmt / price * 100, pay = payment(pathPrice), ppsf = round(pathPrice / sqft), belowCount = active competitors (within radius, with a price) priced below the path, activeCount, bracket (first search bracket within 2%).
- Conservative "who": "Sellers with time, equity and no pressure who want one clean adjustment without leaving money on the table."
- Intermediate "who": "Most sellers: those who want to be sold in 30 to 45 days at a defensible number."
- Aggressive "who": "Motivated timelines, high carrying costs, or a listing that needs a reset after 90+ days."
- Supporting comps for conservative: best comps with price >= path * 0.97, the top three by price, highest first.
- Supporting comps for intermediate: the three best comps closest in price to the path.
- Supporting comps for aggressive: the three lowest best comps with price <= path * 1.04, else the three lowest best comps.
- The conservative rationale template is: "{cons} ({cons/sqft}/sf) sits at the top of what the closed sales support: {'the upper-quartile sold price per foot within {radius} mi implies {compHigh}' | 'the Redfin Estimate is {estimate}'}{', the Redfin Estimate is {estimate}'}. It closes {cutPct}% of the gap, enough to register as a real change on Redfin and in buyer searches, while keeping the seller above the median closed price. [Supporting sales: {comps}.] Expect a two to three week bump in views and a return of showings, not a bidding war. {belowCount} of {activeCount} active competitors within {radius} mi would still be priced below it. Right call when the seller is patient and the home shows better than its comps."
- The intermediate rationale template is: "{inter} ({inter/sqft}/sf) is where the data says the home trades: blended market value is {mv} (Redfin Estimate {estimate}, predicted close {predicted}, best-comp value {compSold}[ at {bestCompPpsf}/sf])[, and it lands under the {activeMedianPpsf}/sf active median so the home re-ranks against the {activeCount} homes it is competing with]. [The closest comparable sales bracket this number: {comps}.] At {dom} days ({tier label}) this is the move that restarts tours and puts the home in front of buyers who filtered it out. {belowCount} of {activeCount} active competitors within {radius} mi would still be priced below it. A buyer at {rate}% with {down}% down pays about {pay}/mo.[ It also lands on the {bracket} search bracket, so two buyer searches see it.]"
- The aggressive rationale template is: "{aggr} ({aggr/sqft}/sf) is priced to win, not to negotiate. The number is set by {aggrWhy}, a {cutPct}% move[, which puts it under three quarters of the active competition][ and at or below the lower-quartile closed price per foot]. [The lowest relevant sales set the floor: {comps}.] The goal is urgency: multiple showings in the first weekend, an offer deadline, and competition that pushes the final price back toward market value. {belowCount} of {activeCount} active competitors within {radius} mi would still be priced below it. Use it when the seller's timeline is short, carrying costs are high, or the listing has already relaunched once and needs a different story."
- compLine(c) formats a comp as "{address}[, {city}] ({price}, {ppsf}/sf[, {sqft} sf][, {beds}/{baths}][, {distance} mi][, sold {date} | , {dom} DOM])".
- The selected band (S.band) defaults to "intermediate", is changed by clicking a band card, and is set from plan.band when a plan is saved with a band.
- The pricing card stat strip shows "Buyer payment today", "2-1 buydown year-1 … (seller cost ~…)" and "Price a buyer needs for the same payment if rates +0.5" (priceForPayment(payment(price), rate + 0.5)).

## Cost of waiting (costOfWaiting)
- Computed only when currentPrice exists.
- disc(tier) = {watch 0, stale discStale, ultra discUltra, extreme discExtreme} / 100.
- carryM (monthly carrying cost) = price * carryPct / 100 / 12 + the seller mortgage payment entered in the plan (l._mortgage, default 0).
- target = the selected band's price when bands exist, else price * 0.97.
- For d = 0, 15, 30, …, 120 days: t = tierOf(dom + d); drift = 1 + (driftPct / 100) * (d / 30); holdSale = price * drift * (1 - disc(t)); holdNet = holdSale * (1 - closingPct / 100) - carryM * (d / 30); repSale = target * (1 + urgencyPct / 100); repNet = null when d < 30, else repSale * (1 - closingPct / 100) - carryM * 1 (one month of carrying).
- waitLine: loss = holdNet(0) - holdNet(90); vs = repNet(30) - holdNet(90); text "holding another 90 days projects about {loss}K less net to the seller than today[, and {|vs|} less|more than repricing now and selling in 30]."; without a price the line is "Every 30 days adds carrying cost and a bigger stale discount."
- The property page chart plots "Hold current price" (gray) and "Reprice now" (accent) nets from day 0 to 120 with x ticks 0, 30, 60, 90, 120 and y formatted in $K; the stat strip shows carrying cost per month, "90-day hold vs today" (holdNet(0) - holdNet(90)) and "Reprice & sell in 30 vs hold 90" (repNet(30) - holdNet(90)); the card subtitle says "net to seller, hold vs reprice to the {band} band".
- Exports tabulate days 0, 30, 60, 90 with columns Days from today, Tier, Expected sale if held, Net to seller if held, Net if repriced now.
- The Overview "90-day cost of waiting" tile sums holdNet(0) - holdNet(90) across all stale-or-worse listings with bands null (subtitle "projected seller net at risk").

# 9. Open house model

## Constants and assumptions
- ASSOCIATE_RATE = 165.0 dollars per associate-hosted open (pipeline) and S.a.ohRate = 165 (page, editable).
- NORM_OPENS = 4 (pipeline) and S.a.ohNorm = 4 (page, editable); a sheet row's "Norm Opens" value overrides the norm per deal when non-zero.
- The high-spend alert threshold is S.a.ohSpendPct = 10 percent of the Redfin commission (page, editable); the pipeline's highSpend10 is fixed at 10.
- Only associates are paid; opens hosted by the listing agent or team are "unpaid"/"agent-hosted".

## Paid and unpaid estimate
- Pipeline paidOpens = min(opens, int(round(cost / 165.0))) when cost > 0, else 0; unpaidOpens = max(0, opens - paidOpens); paidOpensEstimated = true.
- When the event export lists associate-hosted events (hosts.associate > 0), paidOpens = hosts.associate, unpaidOpens = max(0, opens - hosts.associate), paidOpensEstimated = false.
- Page ohDerive recomputes paid = hosts.associate when fromEvents (hosts exist and paidOpensEstimated === false), else min(opens, round(cost / S.a.ohRate)), so changing the associate rate in Assumptions changes the estimate live.
- laHosted (hosted by listing agent or team) = hosts.listingAgent + hosts.teamAgent when hosts exist, else unpaid.
- spendPct = cost / commission * 100 when commission > 0, else null.
- costPerOpen = cost / opens when opens > 0.

## Active flag and listing join
- A deal is active when its Deal ID matches a listing document in the week's db folder (pipeline) or in S.listings (page).
- Active deals carry tier, dom, city, currentPrice and listingAgent from the listing; the page's agentName is the listing's agent, else the sheet's agent, else "Unknown"; the page's address is "<listing address>, <listing city>" when active, else the sheet address, else "Deal <id>".

## Alerts (page ohDerive, in evaluation order)
- Alert id "oh-duplicate", severity high, label "Listed {duplicateRows}× in the sheet": triggers when duplicateRows > 1.
- Alert id "oh-spend", severity high, label "Spend is {spendPct}% of the commission": triggers when spendPct is not null and spendPct >= S.a.ohSpendPct.
- Alert id "oh-zero", severity high, label "Stale 60+ with zero opens": triggers when the deal is active, dom >= 60 and opens === 0.
- Alert id "oh-associate", severity med, label "Every open hosted by a paid associate": triggers when opens >= 3 and laHosted === 0.
- Alert id "oh-above-norm", severity med, label "{opens - norm} past the {norm}-open norm": triggers when opens > norm.
- Short badge labels in tables: oh-spend "$" or "High spend", oh-above-norm "+{vsNorm}" or "+{vsNorm} past norm", oh-associate "assoc." or "Associates only", oh-duplicate "dup" or "Duplicate rows", oh-zero "0" or "Zero opens".
- The Listings flag filter exposes oh-spend ("OH spend ≥ threshold"), oh-above-norm ("Past the OH norm"), oh-associate ("OH hosted by associates only") and oh-none ("60+ with no OH record").

## Rollups (page ohRollup over a scoped list)
- Totals: deals, active, opens, paidOpens, unpaidOpens, cost, commission, priceDropOpens, aboveNorm (vsNorm > 0), highSpend (oh-spend alert), associateOnly (oh-associate alert), duplicates (duplicateRows > 1), activeCost, activeOpens, activeCommission.
- byTier is keyed by the active deal's tier (or "unknown") and "inactive" for non-active deals, each with deals, opens, paidOpens, cost, commission, dom (sum).
- byAgent is keyed by agentName with agent, deals, active, opens, paidOpens, unpaidOpens, cost, commission, aboveNorm, alerts (count of alert entries), priceDropOpens, highSpend.
- spendPct = cost / commission * 100; avgOpens = opens / deals; spendPerActiveListing = activeCost / number of active listings in S.listings; spendPerActiveDeal = activeCost / active.
- ohCommRate = the median of commission / listPrice across sheet deals with both values, defaulting to 0.019 (1.9%) when none.
- ohHeldUp ("Commission tied up in 60+ day listings"): over listings with dom >= 60, known = sum of sheet commissions where a record exists (nKnown deals, spent = their cost), est = currentPrice * ohCommRate for the rest, total = known + est, n = number of 60+ listings.
- OH_TIER_ROWS labels: watch "Watch · 1 to 29", stale "Stale · 30 to 59", ultra "Ultra · 60 to 89", extreme "Extreme · 90+", inactive "No longer active".

## Outliers ordering
- Outliers are deals with any of the alerts oh-spend, oh-duplicate or oh-zero.
- They are sorted by duplicateRows descending, then active before inactive, then spendPct descending.
- The Overview shows up to 6 outliers and the Open Houses tab up to 8; an "All N →" button appears when more exist and opens the Open Houses tab filtered to alert oh-spend sorted by spend %.
- The outlier table columns are Property (address + agent), Status (tier badge + dom, or "Not active"), Opens, Spend, % of commission (red bold), Flags; active rows open the listing page, inactive rows open the Open Houses tab searched by deal id.

## Tiles, popups and trends
- Overview tiles (four): "Open houses held" (opens, trend key opens), "Paid (associate) opens" (paidOpens), "Estimated spend" (cost, $K), "Spend ≥ {ohSpendPct}% of commission" (highSpend, trend highSpend10, extreme color).
- Open Houses tab tiles (six): the four above plus "Spend per active listing" (trend spendPerActiveListing) and "Commission in play" (sub "spend is X% of it").
- Trends on these tiles come from the last four ohweeks documents and a rise is bad.
- Popup "opens": "Who hosted the most opens" top 5 agents by opens, plus "{aboveNorm} of {deals} deals are past the {ohNorm}-open norm; {priceDropOpens} opens followed a price drop."
- Popup "paid": top 5 agents by paid opens with cost; note "From the event-level export." or "Estimated as cost ÷ ${ohRate} (the flat associate rate); unpaid opens are hosted by the listing agent or team."
- Popup "spend": top 5 deals by cost with agent and active state, plus total and spend % of commission in play.
- Popup "per": "{activeCost} spent on the {active} active deals in the sheet ÷ {active listings} active listings this week = {spendPerActiveListing}. Per active deal with opens: {spendPerActiveDeal}." plus a by-tier table.
- Popup "comm": "Redfin commission from the sheet across {deals} deals. Active: {activeCommission}; no longer active: {commission - activeCommission}."
- Popup "high": up to 6 deals at or above the threshold with spend % and cost / commission.
- Popups open on hover, focus or click (class "open"); they flip to the right edge when within 380 px of the viewport's right side.

## Charts and tables
- "Spend by listing tier" is a horizontal bar chart of cost per OH_TIER_ROWS bucket with sub-label "{opens} opens · {deals} deals" and a tooltip including paid opens and % of commission.
- "Opens per deal vs the {ohNorm}-open norm" bars: "≤ {ohNorm} (at norm)" (opens <= 4, green), "5 to 6 opens", "7 to 8 opens", "9 to 10 opens" (stale color for the first two bins, ultra for the next two), "11 to 14 opens", "15+ opens" (extreme); note "The sheet lists deals past the norm; {priceDropOpens} opens followed a price drop."
- "Spend by agent · top 10" bars by cost (red when the agent has a high-spend deal), sub-label "{opens} opens · {deals} deals".
- "Time on market vs profitability" table columns: Status, Deals, Avg DOM (sum dom / deals; "—" for inactive), Commission, OH spend, Spend % (red when >= threshold), Opens/deal; followed by the held-up commission strip and the note "Every week a 60+ listing holds, that commission stays unearned while the seller carries the home and the open house meter keeps running. The cost-of-waiting model on each listing page turns this into seller net."
- "By agent" table columns: Agent, Deals, Active, Opens, Paid, Agent-hosted, Est. spend, Commission, Spend %, Opens/deal, After drops, Alerts; sorted by cost descending; clicking a row filters the deal list to that agent.
- "By listing" table columns (sortable): Property, Agent, Status, Opens, vs norm, Paid / agent, Est. spend, Commission, Spend %, After drops, Alerts, Links ("Deal room ↗" and "Redfin ↗" when the listing has a Redfin URL); active rows open the listing page.

## Listing-page surfaces
- Header badge: "🏠 {opens} opens · {cost}" (red when any high alert, else info) with a hover popup table (Total opens vs norm, Hosted by paid associates with cost, Hosted by listing agent / team, Estimated spend with % of commission, Opens after a price drop, Hosts when hostNames exist, alert pills); or "🏠 no OH record" (amber) for 60+ day listings without a record, with the popup "This deal is not in the open house report, so it has had at most {ohNorm} opens in the last six months. At {dom} days that is an exposure gap: book a weekend open paired with a price move, or document why the seller declined."
- Open houses card facts: Opens · norm, vs norm, Paid / agent-hosted (est.), Est. spend, % of commission, Opens after a drop; alert pills; "Coach's read" line chosen in order: oh-spend "Exposure has been tried {opens} times. The market has answered; the next conversation is price."; oh-associate "Ask the listing agent to host the next open and bring the objections to the seller the same day."; vsNorm > 0 "Past the norm. The next open should carry a new price or a new story, not the same one."; else "Within the norm. Keep logging feedback after each open."
- With events loaded the card shows an "Every open house (N)" details table (Date, Host, Role, Sign-ins) sorted newest first; otherwise the note "Host split is estimated from the sheet's cost at ${ohRate} per associate-hosted open; the event-level export replaces it with names and dates."
- Without a record the card says "Not in the open house report (at or under the {ohNorm}-open norm, or none logged)." plus, at 60+ days, "At {dom} days that is an exposure gap. Book a weekend open paired with a price move, or document why the seller declined."
- The Studio's "Open house record" section (non-seller audiences) reads: "{opens} open houses in the trailing six months against a norm of {norm}[, {priceDropOpens} of them after a price drop]. About {paidOpens} were hosted by paid associates ({cost} estimated[, {spendPct}% of the {commission} commission]) and {laHosted} by the listing agent or team.[ Flags: {alerts}.] {oh-spend: 'Exposure has been tried; the next move is price, and the next open should launch the new number.' | vsNorm>0: 'Past the norm: the next open needs a new price or a new story to pull a different buyer pool.' | 'Within the norm: keep hosting and log the feedback after each one.'}"

## Events export handling and ohScope
- Events are attached per deal as events[], hosts{} and hostNames{} by openhouse.py; the page shows them in the listing card and uses hosts for the paid split.
- ohScope({agents:[...], status:"active"|"inactive"}) is the single entry point: it derives every openhouses document, drops those whose agentName is not in the agents list (when given) and those not matching the status, and returns the derived list for rollups, tiles, insights and tables.
- The README states a team-scoped coaching dashboard can reuse these functions by passing its agent list.

# 10. Early Access model

## Stages, badges and colors
- Stage "exclusive": label "Redfin Exclusive", short "Private exclusive", badge "REDFIN EXCLUSIVE", class ea-red (accent red), order 0, blurb "Private, not on the MLS. Marketed inside Redfin only."
- Stage "redfin": label "Redfin Coming Soon", short "Redfin coming soon", badge "REDFIN COMING SOON", class ea-red, order 1, blurb "Live only on Redfin.com for up to 21 days before the MLS."
- Stage "other": label "Other brokerage coming soon", short "Other brokerage", badge "COMING SOON" (the card shows brokerageBadge when present), class ea-blue (info blue), order 2, blurb "Another brokerage's coming-soon listing on Redfin.com, for buyer-side awareness."
- Stage "live": label "Graduated to the MLS", short "Now live", badge "LIVE ON MLS", class ea-green, order 3, blurb "Left Early Access: it is an active listing now."
- Badge strip sub-labels: exclusive "Internal only", redfin "Only on Redfin.com", other "On Redfin.com, not on the MLS", live "Active"; "NEW" pill when the id is in eaweek.newThisWeek; an area pill when area is not "Los Angeles County".

## Crawl scope and zip-to-area rules
- The crawl plan is every city in LA_CITIES (Los Angeles County), VENTURA_CITIES, SB_CITIES (Santa Barbara County list, which also includes San Luis Obispo County towns), OC_CITIES, plus every distinct city from this week's active listings (tagged Los Angeles County); duplicates by lower-cased name are skipped.
- COUNTIES is [("Los Angeles County", 321), ("Ventura County", 358), ("Santa Barbara County", 344), ("Orange County", 332)] but the region ids are not used by the crawl.
- city_region looks up "<city>, CA" via /stingray/do/location-autocomplete?v=2 and returns (6, id) for a type "2" row whose url starts with /city/ and contains /CA/ and does not start with /city/2112/ (Brentwood in Contra Costa), or (1, id) for a type "6" row whose url starts with /neighborhood/ and contains /CA/Los-Angeles/; results cache in data/raw/ea/cities.json.
- One search call per city: /stingray/api/gis?al=1&market=socal&num_homes=350&page_number=1&region_id=<id>&region_type=<6|1>&sf=1,2,3,5,6,7&status=1&uipt=1,2,3,4,5,6,7,8&v=8 (the loop is range(1, 2), so only page 1).
- A home is kept when mlsStatus == "Coming Soon"; redfin = any sash with sashTypeId 48, or (isRedfin and listingType == 6); other = the sashTypeName of sashTypeId 47; homes already found or with area "Other" are skipped.
- City centroids are accumulated from every crawled home's latLong (cities with at least 2 homes) and extended with active listings' redfin lat/lng.
- area_of(zip) uses the first three digits: 934, 935, 936, 931 -> "Central Coast"; 930, 932, 933 -> "Ventura County"; 926, 927, 928 -> "Orange County"; 900 through 918 -> "Los Angeles County"; anything else -> "Other" (the city argument is ignored).

## Stage precedence (early_access.py, Redfin.com wins over the sheet)
- check_exclusive(pid) calls aboveTheFold with accessLevel=1 and derives publicStage: "live" when the status (lower-cased) is one of active, pending, contingent, active under contract, or searchStatus is 1..5, and the source is not "public records"; "comingsoon" when the status contains "coming"; otherwise "offmarket".
- A sheet home starts as stage "exclusive" with badge "REDFIN EXCLUSIVE".
- If its normalized street address matches an active listing this week, it becomes "live" with dealId, listingAgent, dom, tier and graduated {to: "MLS active", dealId, dom}.
- Else if publicStage is "live", it becomes "live" with graduated {to: "Redfin.com shows <redfinStatus>", dealId: null}.
- Else if publicStage is "comingsoon" or the property id was crawled, it becomes "redfin" with badge "REDFIN COMING SOON" and graduated {to: "Early Access coming soon on Redfin.com"}.
- If the property id was crawled, every non-empty crawled field except stage and badge is merged in, the stage becomes "redfin" when the crawl says redfin (otherwise unchanged) and the badge becomes the crawled badge.
- Address normalization strips unit/apt/# tokens, keeps the part before the first comma, lower-cases and removes non-alphanumerics.
- Crawled homes not in the sheet keep their crawl stage ("redfin" or "other"), get source "redfin.com", and get dealId and listingAgentSheet when their address matches an active listing.
- Sheet homes without a numeric property id are not checked against Redfin.

## 21-day clock and days in Early Access
- EA_DAYS = 21 (stored as eaweek.eaDays).
- For stages redfin and other: daysUsed = dom when dom is not null, else daysInEarlyAccess; daysLeft = max(0, 21 - daysUsed); clock = "green" when daysUsed <= 7, "amber" when <= 14, else "red".
- The page clock bar for these stages fills daysUsed / eaDays (default 21) percent and reads "day {used} of {max} · {left} left".
- For exclusives the page computes clock = "green" when daysInEarlyAccess <= 14, "amber" when <= 30, else "red"; the bar fills days / 45 percent and reads "{days}d in Early Access".
- The README describes the colors as green 0 to 7 days used, amber 8 to 14, red 15 to 21.
- Status lines: exclusive "Private exclusive, not on the MLS ({days} day(s) in Early Access)"; redfin "Early Access coming soon on Redfin.com: day {used} of {eaDays}, {left} left before the MLS"; other "{badge}: on Redfin.com {used} day(s), not yet on the MLS"; live "Now live on the MLS".
- The rollup's "red" count only counts stage redfin homes with a red clock ("in the last week of the window").

## First-seen carry, fingerprint, nearby cities, features
- firstSeen is carried from the previous week's document (from --prev-db, or the same db folder when omitted); new sheet homes get sheetDate, new crawled homes get today.
- daysInEarlyAccess = today - firstSeen.
- nearbyCities = up to 5 other cities whose centroid is within 6 miles (haversine), sorted nearest first; when none are within 6 miles, the nearest 3.
- fingerprint.priceMin = round(price * 0.90, -3); priceMax = round(price * 1.05, -3); bedsMin = max(1, int(beds or 1) - 1); bathsMin = max(1, floor(baths or 1) - 1); cities = [city] + nearbyCities; type from {1: "Single family", 2: "Condo", 3: "Townhouse", 4: "Multi-family", 5: "Land", 6: "Other", 13: "Mobile"} keyed by uiPropertyType or propertyType, default "Home".
- Features regex list applied to remarks (label: pattern): "view": \bview; "pool": \bpool; "ADU": \badu\b|guest house|casita; "remodeled": remodel|renovat|updated; "large lot": lot|acre; "garage": garage; "single story": single[- ]story|one[- ]story; "HOA": \bhoa\b; "new construction": new construction|newly built.
- The card's "Who fits" chips show the price range, "{bedsMin}+ bd · {bathsMin}+ ba", up to 5 cities and each feature as a red-outlined chip.

## Graduation and deletion
- Live (graduated) homes are excluded from eaScope unless includeLive is passed; they appear in the "Graduated to the MLS" card and the listing page shows the "Graduated from Early Access" note.
- The listing page note reads: "🔑 Graduated from Early Access. This home was in the private exclusive inventory from {firstSeen} before it went live on the MLS[; the team logged {matches} matched buyers and {showings} pre-market showings]. Those buyers are the first calls now that it is live."
- Homes gone since last week are listed in eaweek.gone and deleted from the database with "delete" operations (only for keys present in versions.json), 50 per batch, appended after the set batches.
- The page shows "{n} home(s) left Early Access since last week (sold, withdrawn or dropped from the sheet)." when eaweek.gone is non-empty.

## eaScope parameters and page derivation
- eaScope({stage, area, agents:[...], q, includeLive}) derives every earlyaccess document, drops live homes unless includeLive, filters by stage (unless "all"), area, agent list and a free-text query matched against "{title} {zip} {agent} {badge} {area}".
- eaDerive: agent = eameta.agent || listingAgent || listingAgentSheet || matched listing's agent; agentEdited = eameta.agent exists; nCopies = sum of copies; activity = matches + outreach + showings + offers + nCopies; isRedfin = stage exclusive or redfin; title = "{addr}, {city}"; mapsUrl = Google Maps search of "{addr}, {city}, CA {zip}"; dealUrl = https://www.redfin.com/tools/deals/sell/{dealId} when dealId exists.
- addr appends the unit when the address does not already contain it, prefixing "#" unless the unit already starts with "#" or "unit".
- eaRollup counts total, exclusive, redfin, other, live, volume, preVolume (exclusive + redfin prices), activity, copies, outreach, showings, offers, matches, red, newWeek (ids in eaweek.newThisWeek), byArea, byAgent {agent, n, volume, activity}.

## eameta logging and copy counting
- Copying any prompt (data-ea-copy="<id>|<key>") copies the text, increments eameta.copies[key] and appends a log entry {type:"copy", what: prompt label, name, by, at}; the log is cut to the last 40.
- "Add to the tally" reads Matches found, Outreach sent, Showings booked and Offers inputs, adds them to eameta.tally, appends non-empty feedback text to eameta.feedback (last 30) and a log entry {type:"log", what:"<n> matches, <n> outreach, …" or "feedback"}; the toast says "Logged".
- Typing a listing agent on an expanded card and pressing Enter (change event) writes eameta.agent and toasts "Listing agent saved".
- Without a database writeEaMeta toasts "Saved on this device only"; on invalid_argument "Could not save: you need Contributor access".
- The card tally row shows copies (⧉), matches, outreach, showings, offers; the expanded card shows the last 6 feedback notes and the last 5 log entries as "{name} copied {what} {date}" or "{name} logged activity {date}".

# 11. Views and tabs

## Header and navigation
- The sticky top bar shows the Redfin Powered by Rocket logo (linked to #overview), the title "Redfin's Sold Standard" with a sub-line, a search box, the ⚙ Assumptions button and the theme toggle.
- The sub-line reads "Stale Listing Command Center · Week of {meta.asOf} · {meta.count} listings[ · enrichment pending]", or "Stale Listing Command Center · No snapshot yet", or "Database unavailable in this view", or "Could not load listings", and "Loading weekly snapshot…" before data arrives.
- The nav order is: Overview (◎), Early Access (🔑, styled red), Listings (☰), Open Houses (⌂), Agents (◉), Market (↗), Playbook (▤), Weekly upload (⇧).
- The nav buttons play a "glint" shimmer three times on load and the class is removed after 6 seconds.
- Clicking a nav button sets the view, clears the property selection and the Listings filters, sets location.hash to the view name, re-renders and scrolls to top; clicking Open Houses also arms the one-time filter hint.
- Before data loads main shows "Loading the weekly snapshot — Listings, coaching notes and market context load from the dashboard's shared database."; with no listings it shows "No listings yet — Upload this week's sheet under Weekly upload, or ask Claude to run the enrichment pipeline."
- A 12-second fallback marks the page loaded even if no snapshot arrives.

## Overview tab (in order)
- Section head "Executive summary" with "Week of {asOf} · {n} active listings · {n} stale or worse".
- Row label "Listings · week of {asOf}" with help "click a tile to open that bucket · bars are the trailing weeks".
- Two large tiles: "Active listings →" (opens all listings; trend active) and "Stale listings · 60+ →" (opens tiers ultra+extreme; trend stale60, rise bad).
- Four tiles: "Stale listing %" (stale60Pct, trend in "pts", rise bad), "Stale · 30 to 59 →", "Ultra · 60 to 89 →", "Extreme · 90+ →" (each opens that tier; trends tiers.stale/ultra/extreme, rise bad).
- Four tiles: "Stale volume · 30+" (sum of currentPrice over stale-or-worse listings; trend staleVolume), "90-day cost of waiting" (sub "projected seller net at risk"), "Avg gap to market value" (mean gapMV over stale-or-worse listings; its trend bar shows avgDom labelled "N avg DOM"), "30-yr fixed" (market.rates.rate30 with "+/-X.XX vs 1 mo · {rates.asOf}").
- Early Access tile row (when loaded): label "🔑 Early Access · exclusive inventory" with "{exclusive+redfin} Redfin homes before the MLS · checked {checkedAt} · match them with buyers before anyone else sees them" and an "Open the marketplace →" button; tiles "Private exclusives" (sub "$X · internal only"), "Redfin coming soon" (sub "{red} in the last week of the window" or "only on Redfin.com"), "Pre-market volume" (sub "exclusives + Redfin coming soon"), "Team activity" (sub "{copies} prompt copies · {matches} matches · {showings} showings"); each tile opens the Early Access tab with the matching stage filter (activity sorts by team activity descending).
- Open house tile row (when loaded): label "Open houses · trailing six months" with "sheet of {sheetDate} · {deals} deals past the {ohNorm}-open norm · {active} still active · hover a tile for who, what and cost" and "Full breakdown →"; the four tiles from section 9.
- Card "Inventory trend · trailing N week(s)" with sub "{first} to {last} · the board fills to four weeks as snapshots accumulate" containing the trend board: left column "Stale share · week over week" (value, delta in pts, area line chart svgShare, stat strip "Stale 60+ X of Y (last week …)", "Aging 30+ N · P%", "Median DOM N · average N"), "Tier mix · week over week" (svgMix 100% bars per week with counts and totals), "What moved this week" (svgMoves horizontal bars); right column the weeks table.
- The weeks table groups: Inventory (Active listings; Stale 60+ (Redfin definition); Stale 60+ share; Aging 30+ (dashboard tiers)), Tier mix (Watch · 1 to 29; Stale · 30 to 59; Ultra · 60 to 89; Extreme · 90+), Movement (New this week; Left the list; Listings with a price drop; Hot Homes), Time and value (Average DOM; Stale volume · 30+; Expiring within 45 days), Open houses · trailing 6 mo (Open houses held; Open house spend; Spend ≥ 10% of commission); one column per week (newest bold) plus a "Week over week" delta column with ▲/▼/● and a percent sub-label; footer "green means the week moved the right way, red the wrong way, gray is directional only."
- Card "Open house investment · trailing six months" (ohOverview) with sub "{cost} across {deals} deals · {spendPerActiveListing} per active listing · {spendPct}% of the {commission} commission in play", an "Open house breakdown →" button, the outliers block, "Spend by listing tier" chart, "Time on market vs profitability" table and "What to do with this" insights.
- Two-column grid: left "Needs attention this week" (sub "ranked by health, price and tier"; top 10 queue items with rank, address, agent, tier badge, dom, top finding cause, price and "health N"; buttons "Open all listings →" and "Work the 90+ bucket →"; empty text "Nothing stale. Nice.") and "What changed since last week" (badges and chips from section 4).
- Right column: "Tier mix" (svgTier stacked bar with legend and weekly deltas), "Days on market" (svgHist), "Agents carrying the most stale inventory" (top 8 agents by stale-or-worse count then volume; columns Agent, Stale+, 90+, Volume; row click filters Listings by agent), "Sheet rows to fix" (chips "Deal {id} · {agent} · {first data issue}" when any listing has dataIssues), "Expiring within 45 days".

## Early Access tab
- Hero: "Early Access" with "Exclusive inventory, before the MLS sees it. {exclusive} private exclusives and {redfin} Redfin coming-soon homes ({preVolume}), plus {other} coming-soon listings from other brokerages for buyer-side awareness. Copy the Ava prompt under any home, paste it into Ava, and log what you find on the card." and help "Redfin.com is the source of truth: a home that goes live on the MLS leaves this page automatically. Inventory checked {checkedAt}; sheet of {sheetDate}. Refreshed Sundays and Wednesdays."
- Share box "Share this week's inventory" with buttons "⧉ Slack post", "⧉ Email digest", "⬇ Printable one-pager", "⬇ Sheet (for Google Sheets)" and help "Uses whatever is filtered below. The sheet opens straight into Google Sheets with File → Import."
- Four tiles: "Private exclusives", "Redfin coming soon" (sub mentions "the 21-day window"), "Other brokerages coming soon" (sub "on Redfin.com, not on the MLS yet"), "New this week" (sub "{live} graduated to the MLS").
- Filter row (shimmer hint once): stage chips All / Private exclusives / Redfin coming soon / Other brokerages with counts, one chip per area with counts, a listing-agent select, a sort select, a search box and a Clear button.
- Sections "Redfin Exclusive" and "Redfin Coming Soon" each with count and volume, blurb, and a grid of cards; "Other brokerages coming soon on Redfin.com" is a collapsed details block (open when the stage filter is "other") with "{n} listings · {volume} · not Redfin inventory, but your buyers can see them on Redfin.com first".
- Empty state "Nothing matches — Loosen a filter."
- Card "Graduated to the MLS" with chips per live home (opens the listing page when a dealId matches, else links to Redfin.com with the graduated.to text).
- Each card shows: badge strip; hero photo with up to 5 thumbnails (or a no-photo block with the city, "Photos arrive when the listing is prepared" for exclusives or "No photos yet", and "Open map ↗"); price with $/sf; address with city, zip and county when not LA; facts bd, ba, sq ft, built, lot; the clock; "Listing agent: {name}" (input when expanded, "add on expand" when empty, "edited" marker); "Who fits" chips; links "Redfin.com ↗", "Deal room ↗" (when dealId), "Map ↗", "⧉ Ava: find my matches"; the tally row and a "Prompts, outreach & activity ▼" / "Collapse ▲" toggle.
- An expanded card spans the grid and adds: a "Listing remarks" details block, prompt tabs (Find my matches, Draft the outreach, Listing agent, Team broadcast, Ready text, Ready email), the "who" line (with " · intermediate prompt, edit anything in brackets before you send" for find/outreach/listing), the prompt text, buttons "⧉ Copy {label}", "⧉ Copy ready text", "⧉ Copy ready email" with note "Copies are counted on this card so the team can see activity.", and the "Log activity on this home" form.
- Empty state when nothing is loaded: "No Early Access inventory loaded yet — Send Claude the exclusive sheet; the coming-soon crawl runs with it."

## Listings tab
- Head "Listings" with "{shown} of {total} shown".
- Filter row: tier chips with counts, Agent select, City select, Price band select, "+ Flag filter" select, active flag chips with ✕, and a Clear button reading "Clear filters · show all N" or "All N listings shown".
- Table columns (sortable where noted): Property (address, city · band, first data issue in red), Agent, DOM (tier badge + dom), Price (with "↓ $NK" when a price drop), vs market (gapMV), Newer comps ("{newer}" with "{cheaper} cheaper"), Signals, Health (meter + score), Plan ("✓ N moves" with status and due date, or "none").
- Signals badges: "🔥 Hot", "📷" (photos flag), "✎" (remarks flag), "⏰" (expiring, red), "↻" (relisted), "👁 {views}" (latest engagement), "🏠 {opens} · {cost}" (red when a high OH alert) or "🏠 —" (oh-none).
- Empty state "No listings match — Loosen a filter."

## Open Houses tab
- Head "Open Houses" with "trailing six months · sheet of {date} · {shown} of {all} deals shown · event-level hosts loaded | paid opens estimated from cost ÷ ${ohRate}".
- Filter row (shimmer hint for 7 seconds the first time): status chips All deals / Active / Not active with counts, tier chips with deal counts, Agent select, Alert select (Any alert; Spend ≥ N% of commission; Past the norm; Associate-hosted only; Listed more than once; Stale with zero opens), a search box ("Address, agent or deal ID"), Clear button.
- Then: outliers (limit 8), six tiles, three charts (Spend by listing tier; Opens per deal vs norm; Spend by agent · top 10), "Direct reads · market-wide" insights (computed over all deals, not the filtered set), "By agent" table, "By listing" table.
- Empty state when nothing is loaded: "No open house sheet loaded yet — Send Claude the trailing six month open house sheet; it loads here and onto every listing page."

## Agents tab
- Head "Agents" with "{n} agents · click a row to open that agent's listings".
- Tiles: "Agents with listings", "Agents with stale inventory" (stale+ultra+extreme > 0), "Agents with 90+ day listings", "Stale listings with a plan" ("{plans}/{stale+}" where plans counts non-watch listings with saved moves).
- Table columns: Agent, Active, Watch, Stale, Ultra, Extreme, Volume, Avg DOM, Avg health, Plans on file ("{plans}/{stale+}"), OH opens, OH spend (red when the agent has a high-spend deal); rows sorted by stale+ultra+extreme descending then active count.
- Footer: "Open house columns cover the trailing six months, active and closed deals alike; the Open Houses tab has the full breakdown."

## Market tab
- Head "Market context" with "as of {market.asOf}".
- Left: "What this means for a seller sitting at 60+ days" (the narrative, pre-wrapped) and "Talking points by price band" (bulleted per band label).
- Right: "Rates and affordability" (facts 30-yr fixed, 15-yr fixed, 1 month ago, 1 year ago; "Source: {source} · {asOf}"), "Buyer payment calculator · price" (number input, default 1000000, step 5000) with facts "P&I at {rate}%, {down}% down", "if rates +0.5", "max price at same payment, +0.5", "yr-1 payment with 2-1 buydown", "seller cost of 2-1 buydown"; "Local and national stats" table (Metric, Geography, Value, Period with a "source" link).
- The calculator rate is market.rates.rate30 when present, else S.a.rate.
- Empty state: "Market context is loading — Rates, local stats and the narrative appear here once Claude seeds them."

## Playbook tab
- Head "Stale listing playbook" with "the framework behind every recommendation".
- Left: one card per tierPlays entry (tier badge, title, goal, numbered steps, "Decision rules" list) and "Diagnostic framework" (Cause, Observable signals, Fix).
- Right: "Coaching moves" grouped by move group; "Listings coach resource" (principle in bold, "Three drivers behind a stale listing" for price/presentation/perception with desc and italic line, "Diagnosis tests", "Decision paths", "Questions to run in the stale listings hour", "Seller objections" with say/respond, bottomLine); "Price reduction rules"; "Seller scripts" (title, text, "Source: …"); "Stats worth quoting"; "Relaunch rules (CRMLS / California)".
- Fallback when tierPlays is missing: "Tiered playbook — Loads once Claude seeds the research."

## Weekly upload tab
- Head "Weekly upload" with "Drop the new sheet export here each week."
- Left: a drop zone "Drag the CSV here or" with a file input (accept .csv) and the help "Same columns as the Redfin sheet: Deal Id, Deal Status, List Date, Check In Date, Listing Expiration Date, Agent Name, Street Address, City, State Code, Price Drop?, Price Drop Amt, Last Price Reduction Date, Days On Mkt, Deal URL, Suggested Price Amount, Original Price Amount, Current Price, Current Redfin Estimate, Predicted Close Price Amount, Hot Home Score."
- Right: "How the weekly cycle works" steps: 1 "Upload the sheet here. Base fields, tiers and week-over-week history update immediately for every Deal ID. Coaching notes, plans and engagement entries carry over."; 2 "Send Claude the sheet link. The enrichment pipeline re-pulls every Redfin.com page (photos, remarks, competition, price history) and refreshes market context. Listings show "enrichment pending" until then."; 3 "Run the stale listings hour. Work the queue, log plans and send feedback."; plus "Snapshot on file: {asOf} · {n} listings."
- On file selection or drop the page parses the CSV; a parse failure shows "Could not parse the file."; a missing Deal Id column shows "This does not look like the Redfin sheet (no "Deal Id" column)."
- A parsed file shows "{rows} rows parsed. {added} new, {gone} no longer on the sheet, {newStale} crossed 30 days, {newUltra} crossed 60, {newExtreme} crossed 90, {priceDrops} price drops." and an "Apply to the dashboard" button.
- Apply writes each listing document (merging the old document, the new base fields, history and the redfin block as described in section 2), rewrites gone listings with status "Removed from sheet", writes meta/current with enrichment "pending", toasts "Dashboard updated for {date}" and switches to Overview; progress reads "Saving n/N…"; failures toast "Save failed: …" and re-enable the button; without a database it toasts "Database not available in this view".

## Property page (opened from any row, chip or #deal-<id>)
- Back button "← Back to {overview|listings|agents|open houses}" with " (your filters are kept)" when Listings filters are active.
- Header: "{address}, {city}", tier badge, "{dom} days", "(Redfin shows N cumulative)" when different, agent, "Listed {listDate}", "Expires {expirationDate} ({daysToExpiration}d)", "🔥 Hot Home" badge, "Open house" badge (redfin.hasOpenHouse), the open house badge; links "Open on Redfin.com ↗", "Deal tools ↗" (dealUrl), "Copy link to this property" (copies "{page url}#deal-{id}").
- Health card: the score in its color, "listing health · priority {priority}", a meter.
- "Graduated from Early Access" note when applicable; "Data issue: {issues}. Fix the sheet row and re-upload." card when dataIssues exist.
- Left column card "On Redfin.com" (sub "{photoCount} photos · pulled {asOf}" or the redfin.error or "enrichment pending"): photo grid with a hero (selected index) and clickable thumbnails ("Showing N of M listing photos in MLS order. Click a thumbnail to enlarge. Photo K is the lead photo buyers see first."), lead-photo stat strip, facts (List price; Redfin Estimate; Predicted close; Sold-comp value; Bed / bath; Sq ft · $/sf; Built · lot; Original · cut N%; Open houses · est. spend when a record exists), "Agent remarks ({n} chars)" box, "Price history" (first 8 Redfin history events: date, event, price).
- Card "Buyer engagement" (sub "views, favorites and X-outs from Redfin tools; log them weekly"): latest facts Views, Favorites · ratio%, X-outs, Tours, Offers; a Views/Favorites line chart when more than one entry; a form Date (default today), Views, Favorites, X-outs, Tours, Offers with "Log this week" and "{n} entries".
- The open houses card (section 9).
- Card "Competition and comps" (sub "map search within {radius} mi" or "Redfin similar homes (no distance data)" or "pending"; radius chips 0.5 mi / 1 mi): facts Active within {radius} mi, Listed after ours, Priced lower, Active $/sf · ours, Closed sales, 180 days, Sold $/sf median, Sold $/sf quartiles, Best-comp value · $/sf; "Best comparable sales (ranked by size, beds, distance, recency)" table of up to 5 (Sold comp, Price, $/sf, Bd/Ba, Sq ft, Dist, Sold, Match); "Active competition ({n} within {radius} mi, nearest first; "newer" came on after ours)" table of up to 15 with ▼ on cheaper prices and a "newer" badge when the comp's dom is below ours (empty row "No active competition inside {radius} mi. Widen to 1 mi."); details "All closed sales within {radius} mi ({n})" up to 40; textarea "Your comps and notes" (saved to coaching.compNotes on change); pending text "Competition loads once the enrichment pipeline runs."
- Card "Week over week" when history has more than one entry: last 8 entries newest first with Week, DOM, Price, Estimate, Tier, Hot.
- Right column card "Diagnosis" (sub "what the data says is holding this listing back"): driver badges, then each finding with severity bar color (high red, med amber, low gray), cause, driver badge, evidence, "Coach's note: {line} {question}" and "→ {move labels}".
- Card "Recommended path: {label}" (sub "primary driver · {label}").
- Card "Pricing paths" (sub "blended market value {mv} · gap {gapMV} · comps within {radius} mi"): three band cards (label, price, "{cut} · {cutPct}% · {ppsf}/sf · ~{pay}/mo", "Who it fits", "{below} of {active} competitors still cheaper", "Lands on the {bracket} search bracket"), "Why {band}: the rationale" with the supporting sales table (Supporting sale, Price, $/sf, Sq ft, Dist, Sold), the payment stat strip.
- Card "Cost of waiting" (section 8) with "Edit assumptions with the ⚙ button."
- Card with tabs "Recommendation Studio" and "Listing feedback" (the AI panel); the Studio opens by default.
- Card "Team notes" (sub "left here for the next person who opens this listing"): notes newest first with an avatar (a red circle with one letter generated from the user id), name, timestamp and text; textarea "Add a note for the team…" with "Post note"; empty text "No notes yet. Use this during the stale listings hour to capture ideas, seller feedback and decisions."
- Opening a property resets heroIdx to 0, assetTab to "pdf" and ptab to "studio" and sets location.hash to "deal-{id}".

## Recommendation Studio (inside the property page)
- Step chips: "1 Plan the moves" (done when a plan with moves is saved), "2 Build the recommendation" (done when no step-2 issues remain), "3 Create the asset".
- Step 1 (plan panel): path badges A–D (recommended highlighted, hover shows steps), the primary driver's question and "Recommended moves are outlined. Tick what you and {agent first name} agree to; everything saves for the team.", move checkboxes grouped by move group (recommended ones dashed with a "rec" badge), form fields Price path (Not decided / Conservative / Intermediate / Aggressive), Target price, Owner (default the agent), Due, Status (planned / in progress / done / seller declined), "Seller mortgage pmt / mo (optional)", Plan notes, "Save plan" with "Last saved {datetime}" or "Not saved yet".
- Step 2: audience chips Agent coaching ("Manager to agent. Direct, specific, accountable."), Seller-facing ("Agent to seller. Plain English, calm, market-driven, no jargon."), Team / manager brief ("For the stale listings hour and leadership."); switching audience clears section edits, title and prepared-for.
- Step 2 form: "Asset title *" (default the headline section title), "Prepared for *" (default the agent, or blank with placeholder "Seller name(s)" for seller audience), "Prepared by" (required for seller audience; default the viewer's name), "Label / tag" (placeholder "e.g. Week 1 relaunch plan").
- Help: "Click a section to include it, edit its title or text, reorder with the arrows. Generated text refreshes from the data until you edit it; Reset brings it back."
- Section list in default order: headline, snapshot, openhouse (agent/team only, when a record exists), signal, photos, pricing, comps, newcomp, cost, plan, financing, talk, objections, next; financing and objections are off by default; each row has an include checkbox, an editable title, ↑/↓ buttons, a Reset button when edited, and a textarea (objections shows objection chips instead).
- The photos row adds "Photos in asset" chips none / 6 / 11 / 15 (default 11); the pricing row adds "Paths to show" chips with prices; the comps row adds "include the comps table with links"; the newcomp row lists up to 6 new competitors with links.
- "Save studio" writes coaching.studio and shows "✓ Saved {time}" or "✕ Not saved: {reason}".
- Step 3 issues (block "Before this asset can be created:" with clickable items that scroll to and outline the target): "Step 1: pick at least one move for the action plan and save it."; "Step 2: give the asset a title."; "Step 2: say who this is prepared for."; "Step 2: a seller-facing asset needs a prepared-by name."; "Step 2: include at least one section."; "Step 2: the pricing section is included but no path is ticked."; "Pricing is included but this listing has no price on the sheet."; "Step 2: "{title}" is included but empty. Add text or reset it."
- Step 3 asset tabs: "PDF / web page" (Create PDF, Create web page (.html), Preview, Log as shared), "Email" (subject input, body textarea, "Create in Gmail ↗", Copy email, Log as sent), "Slack" (textarea, "Create and copy for Slack", Log as sent), "Spreadsheet" (Create spreadsheet (.xlsx), Create comps file (.csv), Log as shared).
- Creating any asset first runs gateStudio: unresolved issues block with the toast "A few things are missing. Jumping to the first one."; the studio is auto-saved; a failed save toasts "Saved on this device only; the asset still generates."

## Listing feedback (AI) panel
- Text: "Listing feedback from Claude — Claude reads this property's Redfin data, photos, remarks, competition, engagement, market context and the playbook, then writes the diagnosis, pricing rationale, a remarks rewrite, the agent message in Orlando's voice and the seller guide. You can edit everything before sharing."
- Button "Generate listing feedback" / "Regenerate feedback" / "Thinking…" with a Stop button while busy; "Claude access is not available in this view." when the sample capability is missing.
- Output: "Generated {datetime}", headline, diagnosis bullets, "Pricing rationale", "Photo and presentation notes", "Remarks rewrite" with "Copy remarks", "Rocket angle", and "The agent message and seller guide Claude wrote feed the Recommendation Studio sections."
- Status text while running: "Reading the listing, competition and market…" then "Writing… {n} lines".
- Error toasts: not_granted "Claude access was declined for this page"; rate_limited "Claude is busy, try again in a minute"; invalid_json "Claude's answer could not be parsed, try again"; otherwise "Claude could not complete this request"; a cancel is silent.
- Up to 4 cached photos are attached as images when the sample capability reports image support.
- The share panel (Slack message / Email / Seller guide / Health report tabs, with "Open in Gmail", "Reset to generated", "Log as sent", "Download report (.html)", "Download PDF", "Preview") is defined in the code (sharePanel, reportHTML, downloadReport) but no view renders it; the property tabs only offer the Studio and the AI panel, so the Listing Health Report is unreachable from the UI.
- The AI panel's note that the agent message and seller guide feed the Studio is not implemented: the Studio's default sections do not read coaching.ai.

# 12. Filters, sorts, modes and settings

## Global search
- The header search box (placeholder "Search address, agent, city or deal ID") sets S.f.q on every keystroke, switches to the Listings tab (leaving any open property) and re-renders.
- The Listings query matches case-insensitively against "{address} {city} {agent} {dealId}".
- Clearing filters (clearFilters) resets q, tiers, agent, city, band and flags and empties the search box; sort and direction are kept.

## Listings filters (S.f)
- tiers: multi-select chips watch, stale, ultra, extreme (toggle on click); unknown is not offered.
- agent: single select from the distinct agent names (sorted).
- city: single select from the distinct cities (sorted).
- band: single select under750, 750to1500, 1500to3000, over3000, unknown.
- flags: multi-select added from the "+ Flag filter" select; options (value: label): overpriced "Over market"; competition "Newer/cheaper competition"; photos "Weak photos"; remarks "Weak remarks"; no-reduction "No price cut yet"; stale-reduction "Cut has worn off"; expiring "Expiring ≤45d"; relisted "Relisted before"; traffic-down "Traffic falling"; noPlan "No plan on file"; hasPlan "Has a plan"; no-engagement-data "Needs views/favorites entry"; oh-spend "OH spend ≥ threshold"; oh-above-norm "Past the OH norm"; oh-associate "OH hosted by associates only"; oh-none "60+ with no OH record".
- hasPlan requires coaching.plan.moves to be non-empty; noPlan requires it to be empty; every other flag must be in the listing's analysis flags.
- Sort keys (clicking a column header toggles direction when the same key, otherwise sets the key with default direction asc for address, agent, city and desc otherwise): priority (default, desc), dom, price, health (score), agent, city, gap (gapMV, missing as -999), competitors (newerCompetitors), expiration (daysToExpiration, missing as 9999), address.
- Overview tile clicks preset tiers: "all" clears, "stale60" sets ultra+extreme, otherwise the single tier; agent rows set the agent; the "norec" insight sets tiers ultra+extreme with flag oh-none.

## Open Houses filters (S.of)
- q: text matched against "{address} {agentName} {id}".
- status: "all", "active" or "inactive" chips; choosing inactive clears the tier chip.
- agent: single select; clicking a By agent row toggles it.
- tier: single tier chip toggle (choosing one while status is inactive resets status to all).
- alert: "" (All alerts), "any", "oh-spend", "oh-above-norm", "oh-associate", "oh-duplicate", "oh-zero".
- Sort keys (By listing headers): cost (default, desc), opens, spendPct (missing as -1), commission, vsNorm, dom (missing as -1), address, agent (address and agent default asc), paid (paidOpens), drops (priceDropOpens), alerts (alert count).
- Deep links from elsewhere: an inactive outlier row searches by deal id; "All N →" sets alert oh-spend sorted by spendPct; insight "Show me →" buttons set alert oh-spend sorted by spendPct ("spend"), alert oh-associate ("associate"), status inactive ("inactive"), status active sorted by dom ("stale"), or the agent ("agent:<name>").
- Clear ("Clear filters" / "All N deals shown") resets to the defaults q "", status all, agent "", tier "", alert "", sort cost desc.

## Early Access filters (S.ef)
- stage: "all", "exclusive", "redfin", "other" chips.
- area: one area chip toggle.
- agent: listing-agent select.
- q: text matched against title, zip, agent, badge and area (placeholder "Address, city, zip or agent").
- sort select: "Sort: urgency" (days: exclusives by daysInEarlyAccess, others by daysLeft or 99; asc), "Sort: newest" (firstSeen, desc), "Sort: price" (desc), "Sort: team activity" (activity, desc), "Sort: city" (asc), "Sort: agent" (asc).
- open: the id of the one expanded card (toggle; expanding scrolls the card into view).
- Clear ("Clear filters" / "All N shown") resets stage, area, agent, q and sort to defaults and keeps the open card.
- Overview tile deep links set the stage (exclusive, redfin, other, all) or sort by activity descending ("active").

## Property page modes
- S.band: selected pricing path (default "intermediate").
- S.radius: 0.5 or 1.0 miles (default 1.0).
- S.heroIdx: selected photo index.
- S.ptab: "studio" or "ai".
- S.assetTab: "pdf", "email", "slack" or "sheet".
- S.stab: "slack", "email", "seller", "report" (used only by the unreachable share panel).
- The Market tab calculator price (S._calcPrice) is kept in memory for the session.

## Theme toggle and storage
- The theme button toggles document.documentElement.dataset.theme between "dark" and "light" and saves it under localStorage key "slcc-theme"; the button shows "☀ Light" in dark mode and "☾ Dark" in light mode.
- The initial theme is the stored value or "light"; CSS also honors prefers-color-scheme: dark when no explicit light theme is set.
- Dark mode adds a subtle text glow on KPI values, facts, trend values, deltas, badges and chart marks.
- Assumptions are stored under localStorage key "slcc-assump" (section 8).
- Hot-reload state (window.claude.hot) snapshots and restores view, sel, f and ptab across republishes.

## Hint and shimmer behavior
- The first time the Open Houses tab is opened in a session (S.ohHint true at boot and re-armed by clicking its nav button) the filter row shimmers for 7 seconds with the label "✦ Tap a status, pick an agent or type an address to filter".
- The Early Access tab reuses the same one-time flag with the label "✦ Pick a stage, an area or an agent, or search an address".
- Deep links from tiles and insights disarm the hint.
- Reduced-motion preferences disable the shimmer, glint and transitions.

## URL hash routing
- Hashes "overview", "earlyaccess", "listings", "openhouses", "agents", "market", "playbook" and "upload" select a view; "deal-<dealId>" opens that property.
- The page listens to hashchange and re-routes; navigation and property opens write the hash; back from a property writes the current view's hash.
- "Copy link to this property" copies "{page URL without hash}#deal-{dealId}".

## Tooltips and popups
- Elements with data-tip show a fixed tooltip that follows the mouse (12 px offset).
- Elements with class has-pop show their .pop on hover, focus or click; clicking toggles the "open" class and closes other open popups.

# 13. Insights

## Overview reads
- Queue item "why" line: "{tier badge} {dom} days · {top finding cause}" or "Review" when no findings.
- "What changed since last week" badges: "◑ N crossed 30 days", "◕ N crossed 60 days", "● N crossed 90 days", "↓ N price drops", "✓ N left the list", "+ N new listings".
- Trend board stale share delta: "{d} pts" with ▼ (good) or ▲ (bad), or "first week".
- Weeks table footnote: "green means the week moved the right way, red the wrong way, gray is directional only."
- Tile trend text: "▲ +{d} ({pct}%) wk", "▼ {d} ({pct}%) wk" or "● 0 wk"; with fewer than two weeks: "Trend builds from next week".

## Open house insights (ohInsights; at most 5, in this order)
- Tag "Price, not exposure", when highSpend > 0: "{n} listing(s) has/have open house spend at or above {ohSpendPct}% of the commission (highest: {address} at {pct}%). When more exposure keeps failing to produce an offer, the market has already answered: take the seller back to the pricing paths before the next open." (go: spend)
- Tag "Exposure gap", when ohweek.stale60NoRecordIds has ids that are current listings: "{n} active listing(s) is/are 60+ days with no open house record in the last six months (at most {ohNorm} opens). Pair a weekend open with a price move on each, or document why the seller declined." (go: norec)
- Tag "Spend concentration", when active spend on 60+ day listings is at least 40% of active spend: "{pct}% of active open house spend ({cost}) sits on listings that are 60+ days. Every ${ohRate} after the fourth open on a stale listing buys the same feedback again." (go: stale)
- Tag "Who hosts", when associateOnly > 0: "{n} listing(s) with 3+ opens was/were hosted only by paid associates. The agent who hosts hears the objections first; ask each listing agent to take the next open and bring the feedback to the seller the same day." (go: associate)
- Tag "Coaching conversation", when the top-spend agent has at least 2 deals: "{agent} carries the highest open house spend ({cost} across {deals} deals, {opens} opens). Question for the 1:1: which of these would have sold with one price move instead of four more opens?" (go: agent:{name})
- Tag "Drops and opens", when priceDropOpens and opens exist: "{n} opens ({pct}% of all opens) followed a price drop. When a drop plus an open does not convert within two weekends, the cut was too small to re-rank the home in buyer searches."
- Tag "Where the money went", when inactive spend is at least 50% of total: "{pct}% of the six-month spend ({cost}) is on deals no longer active. Where they closed, the opens did their job; where they expired or withdrew, that spend left with the listing." (go: inactive)
- The Overview shows the insights under "What to do with this"; the Open Houses tab under "Direct reads · market-wide"; each with a "Show me →" button when it has a go target.

## Early Access reads
- Tile subs: "{red} in the last week of the window" / "in the last week of the 21-day window", "{copies} prompt copies · {matches} matches · {showings} showings", "{live} graduated to the MLS".
- Hero help: "Redfin.com is the source of truth: a home that goes live on the MLS leaves this page automatically. Inventory checked {date}; sheet of {date}. Refreshed Sundays and Wednesdays."
- Gone line: "{n} home(s) left Early Access since last week (sold, withdrawn or dropped from the sheet)."
- Card no-photo text: "Photos arrive when the listing is prepared" (exclusive) or "No photos yet".
- Listing-page graduation note (section 10).

## Agents reads
- The Agents tab has no generated sentences beyond the tile labels and the open house footnote.

## Property page reads
- Pricing card sub: "blended market value {mv} · gap {gapMV} · comps within {radius} mi".
- Cost of waiting help: the waitLine sentence plus "Edit assumptions with the ⚙ button."
- Photo caption: "Showing {n} of {m} listing photos in MLS order. Click a thumbnail to enlarge. Photo {k} is the lead photo buyers see first." (the trailing sentence only for photo 1).
- Open house "Coach's read" lines (section 9).
- Diagnosis "Coach's note: {driver line} {driver question}".
- Empty diagnosis: "No red flags from the data — Keep the plan simple: confirm engagement numbers and hold the seller to the review date."
- Engagement empty: "No entries yet. Add this week's numbers from the Redfin listing tools."
- Competition pending: "Competition loads once the enrichment pipeline runs."

# 14. Scripts, prompts and coaching lines

- Templates below are quoted from the code; "\n" marks a line break inside a template, {placeholders} mark substituted values, and [bracketed] fragments appear only when their condition holds.

## Slack message to the agent (slackText; used by the unreachable share panel and as the fallback text; the Studio generates its own Slack asset)
- Line 1: "🏠 *{address}, {city}* — {TIER LABEL UPPERCASE} at {dom} days\n".
- Line 2: "Agent: {agent}\n\n".
- "📊 *Where it stands*\n• List {currentPrice}[ (was {originalPrice})] | Redfin Estimate {estimate} | Predicted close {predicted}\n".
- When redfin.ok: "• {similarActive.length} similar actives, {newerCompetitors} listed after us, {cheaperCompetitors} priced lower | {photoCount} photos[ | 🔥 Hot Home]\n".
- When engagement exists: "• Redfin traffic: {views} views, {favorites} favorites, {tours} tours ({date})\n".
- "• Listing health {score}/100 · primary driver: {driver label}\n\n".
- "🔍 *What the market is telling us*\n" then the first three findings as "• {cause}: {evidence}" joined by newlines, then "\n\n".
- "✅ *The plan*\n" then each chosen move (the saved plan's moves, else the first 4 recommended) as "• {label}" joined by newlines, then "\n".
- When bands exist: "• Pricing: {band label lower} band at *{price}* ({cutAmt} / {cutPct}% move[, {ppsf}/sf]). Buyer payment at {rate}% with {down}% down: ~{pay}/mo.\n".
- When the band has comps: "• Best comps behind that number: {address} {price K}[ ({ppsf}/sf[, {distance} mi])]; …\n".
- When plan.targetPrice: "• Target price agreed: {targetPrice}\n".
- "\n⏳ *Why now*: {waitLine}\n".
- "\n📅 Owner: {plan.owner or agent} | Due: {plan.due or 'this week'}[\n📝 {plan.notes}]\n".
- "\n🧭 *Coach's note*: {driver line or coach.principle}\n\nLet's get this one moving. Reply with the seller call date and I'll back you on the conversation. 💪".

## Email to the agent (emailText)
- Subject: "{address}, {city} — {Tier label} at {dom} days: our relaunch plan".
- Body opens: "Hi {agent first name},\n\nI went through {address} on Redfin.com and the market around it this week. Here is where it stands and what I recommend. All of this is a starting point for us to adjust together.\n\n".
- "WHERE IT STANDS\n- {dom} days on market ({Tier label}), listing health {score}/100\n- List price {currentPrice}; Redfin Estimate {estimate}; predicted close {predicted}[; sold comps imply {compSold}]\n".
- When redfin.ok: "- {similarActive.length} similar actives nearby, {newerCompetitors} came on after ours and {cheaperCompetitors} are priced lower\n- {photoCount} photos; remarks {remarksLength} characters; open house scheduled | ; no open house scheduled\n".
- "\nWHAT THE MARKET IS SAYING\n" then every finding as "- {cause}. {evidence}".
- "\nTHE PLAN\n" then "{n}. {label}: {desc}" per chosen move.
- When bands exist: "\nPRICING\n{Band label} band: {price} (a {cutAmt} or {cutPct}% move). {rationale}\n\nThe other two paths for the seller conversation: Conservative {price}, Intermediate {price}, Aggressive {price}.\n".
- "\nWHY NOW\nThe cost of waiting is real: {waitLine}\n".
- "\nNEXT STEPS\n- Owner: {owner}\n- Due: {due or 'end of this week'}\n- Seller conversation: use the Seller Guide in the dashboard; I am happy to join the call.\n[- Notes: {notes}\n]".
- Closing: "\nYou have put real work into this listing and the seller trusts you. Let's give them a clear plan and a date, and get it sold.\n\nThanks,\n".

## Seller conversation guide (sellerGuide)
- Header: "SELLER CONVERSATION GUIDE — {address}, {city}\nFor {agent} | Prepared {today}\n\n".
- "1. OPEN WITH THE FACTS (2 minutes)\n"We have been on the market {dom} days. In that time {similarActive.length} similar homes have been competing with us and {newerCompetitors} of them came on after we did | the competition has changed. Buyers are seeing those first. I want to walk you through what the data says and give you three options."\n\n".
- "2. WHAT BUYERS ARE SEEING\n- Redfin Estimate: {estimate} | Our price: {currentPrice}[ | Gap to blended market value: {gapMV}]\n[- Active competition median: {activeMedianPrice} | Sold comps median: {soldMedianPrice} ({soldMedianDom} days to sell)\n]- At {rate}% today, a buyer with {down}% down pays about {payment}/month for our home. Every $25,000 off saves them roughly {payment(25000)}/month.\n[- The sales buyers compare us to (within {radius} mi): {up to 4 compLines}.\n]\n".
- "3. THREE PATHS (let the seller pick based on their timeline)\n- Conservative {price}: {rationale}\n- Intermediate {price}: {rationale}\n- Aggressive {price}: {rationale}\n\n".
- "4. THE COST OF WAITING (say it plainly)\n"If we hold where we are, the home keeps aging. Buyers assume something is wrong past 90 days and offers come in lower. [My projection is roughly {loss}K less in your pocket if we are still here in 90 days, once carrying costs and the stale discount are counted. ]Repricing now gets you to the finish line sooner and usually at a better net."\n\n".
- "5. WHAT WE WILL DO BESIDES PRICE\n" then up to four recommended non-PRICE moves as "- {label}: {desc}".
- "6. FINANCING LEVER (Rocket)\n"Instead of only cutting price, we can offer a rate buydown through Rocket. A seller-paid 2-1 buydown on this price costs roughly {buydownCost} and drops the buyer's first-year payment by about {payment - payment at rate-2}/month. Buyers shop by payment; this is a headline we can market."\n\n".
- "7. CLOSE WITH A DECISION\n"Which path fits your timeline? Let's pick one today, I will have the new price, photos and copy live within 72 hours, and we will review traffic together next {weekday one week from today}."\n\n".
- "QUESTIONS TO ASK THE SELLER\n- What changes for you if this takes another 90 days?\n- Is there a number where it no longer makes sense to sell?\n- Would a payment-focused offer (buydown) feel better than a price cut?\n".

## Recommendation Studio default sections (defaultSections)
- headline title (seller): "{address}: what the market is telling us and our plan"; (agent/team): "{address}, {city}: {Tier label} at {dom} days"; body (seller): coach.sellerGuidance.goal; (agent/team): "Primary driver: {label}. {desc} {line}".
- snapshot "Where it stands": "{dom} days on market ({Tier label}). List {currentPrice}[ (originally {originalPrice})]. Redfin Estimate {estimate}, predicted close {predicted}[, best-comp value {compSold}]. [{activeCount} active competitors within {radius} mi, {newer} listed after this home, {cheaper} priced lower. {photoCount} photos[, Hot Home][, open house scheduled].][ Redfin traffic: {views} views, {favorites} favorites, {tours} tours ({date}).][ Listing health {score}/100.]" (health omitted for the seller audience).
- openhouse "Open house record": section 9 text (agent/team only).
- signal "What the market is telling us": seller audience lists "• {sellerized cause}. {evidence}" per finding then "\n\n{sellerGuidance.whyItMatters}"; other audiences list "• {cause} ({driver label}). {evidence} Coach's note: {coachNote}".
- photos "On Redfin.com": seller "Buyers decide in seconds. They react first to {first three buyersRespondTo}. We will make sure the first seven photos tell a clear walkthrough story and that nothing in the gallery gives a buyer a reason to hesitate."; other "{photoCount} photos on the listing. {'The set is thin or weak: ' | 'Photo count is fine, so the question is the story: '}{first three photoRules} Review the first seven as a walkthrough, group the kitchen shots, and pull anything that triggers fear or looks dated."
- pricing title (seller) "Three ways to position the price" / "Pricing paths": seller "{driver sellerLine} {coach.pricing[2]} {coach.pricing[1]}"; other "{coach.pricing[0]} {coach.pricing[1]} The recommended path for this listing is the {band} band."
- comps "The sales buyers compare us to": "Best comparable closed sales within {radius} mi, ranked by similarity: {compLines}." or "Comparable sales load once the enrichment runs."
- newcomp "New competition in the last 30 days": "{n} similar home(s) within {radius} mi came on in the last 30 days. These are the listings buyers see first today, and {k} of them are priced below ours." or "No new similar listings inside {radius} mi in the last 30 days. The competition is older inventory, which makes a fresh relaunch stand out more."
- cost "The cost of waiting": "{WaitLine capitalized} {'Holding is a decision too, and it has a price.' | 'Use this in the seller meeting; it turns a price conversation into a net-proceeds conversation.'}"
- plan title (seller) "What we recommend" / "The plan": "{path label}\n{n}. {label}: {desc}…[\nTarget date: {due}.]"
- financing "Rocket financing lever": "Instead of only moving price, a seller-paid 2-1 buydown through Rocket on {currentPrice} costs roughly {buydownCost} and lowers the buyer's first-year payment by about {diff} a month. Buyers shop by payment; this is a headline we can market in the remarks."
- talk title (seller) "How we think about it" / "Seller conversation": seller "We want the listing to feel easy to say yes to: {howWeThink joined}. {sellerGuidance.honest}"; other "Open: "{scripts.opening[0]}" Price: "{scripts.price[3]}" Presentation: "{scripts.presentation[2]}" Urgency: "{scripts.urgency[2]}" Alignment: "{scripts.alignment[0]}"".
- objections title (seller) "Questions you may be asking" / "Objections to be ready for": rendered from the selected objection ids as "• "{say}" → {respond}" (text) or bold say plus respond (HTML).
- next "Next steps": seller "Pick the path that fits your timeline. Within 72 hours of your decision the new price, photo order and description go live, and we review traffic together the following week."; other "Owner: {owner}. Due: {due or 'end of this week'}. Seller meeting booked, moves live within 72 hours, traffic review next {weekday}. {coach.firmLines[1]}".
- Seller-facing cause rewrites (sellerize): "Fresher and cheaper competition came on after this listing" -> "Newer and lower-priced homes are now competing for the same buyers"; "Priced above what the market is saying" -> "The price sits above what recent buyers have paid for similar homes"; "Photo set is not pulling its weight" -> "The photos are not telling the home's best story yet"; "Remarks describe the house but do not sell the deal" -> "The description tells buyers what the home is, not why to act"; "No price response to market feedback" -> "The market has given feedback and the price has not answered yet"; "Last reduction has worn off" -> "The last price change has stopped drawing attention"; "No action plan on file" -> "We have not yet agreed on the next move"; "Listing agreement is close to expiring" -> "Our listing agreement is coming up for renewal".
- Studio text asset header: "🏠 *{title}*\n" (Slack) or "{title}\n", optional "{tag}\n", "Prepared for {preparedFor} by {preparedBy} · {date}\n\n"; section headers are "*{title}*" with "📌 " in Slack or UPPERCASE otherwise; the email asset ends with "Thanks,\n{preparedBy}".
- Studio pricing lines: "• {label}: {price} ({cutPct}% move, ~{pay}/mo for the buyer). {rationale}".
- Studio comps lines: "• {address}: {price} · {ppsf}/sf · {sqft} sf · {distance} mi · sold {date}[ · {url}]".
- Studio new competition lines: "• {address}, {city}: {price} · {ppsf}/sf · {beds}/{baths} · {dom} DOM · {distance} mi[ · {url}]".

## AI coaching request (runAI prompt)
- The data object sent includes listing facts (address, city, agent, dom, tier label, listDate, expiration, currentPrice, originalPrice, priceDrop, priceDropAmt, lastReduction, redfinEstimate, predictedClose, soldCompValue, blendedMarketValue, gapToMarketPct, hotHome, openHouse, beds, baths, sqft, pricePerSqft, yearBuilt, photoCount, lowResPhotos, leadPhotoBrightness, remarks, priceHistory, cumulativeDom), competition (radiusMiles, stats, newerThanOurs, cheaperThanOurs, bestComparableSales (5), bestCompValue, bestCompPpsf, nearestActives (10), otherSolds (solds 6 to 12)), the last 4 engagement entries, manualComps, ruleDiagnosis, pricingPaths, assumptions, existingPlan, the last 6 team note texts, market (rates, narrative, the band's talking points, first 25 stats), playbook (moves as "ID: label — desc", the tier's play, pricing rules, relaunch rules, first 12 stats) and coachResource (principle, primaryDriver, recommendedPath, drivers, tests, photoRules, staging, pricing, scripts, objections say/respond, firmLines).
- Prompt text: "You are a senior Redfin Powered by Rocket sales manager in Los Angeles coaching an agent on a stale listing. Voice: direct, supportive, accountable, specific, optimistic, no filler. Use the data below (it is real) and never invent numbers that are not in it. Where you compute something, show the math briefly. Weave the coachResource in naturally: frame the diagnosis around the primary driver (price, presentation, or perception), use the decision path, borrow the script lines and objection responses where they fit, and apply the photo and staging rules to THIS home's photos and remarks. Never paste the resource; make it feel personal to this listing and its market."
- Followed by "DATA (JSON):" and the JSON, then "Reply with ONLY a JSON object with these string fields (arrays where noted):" and the schema.
- Schema field "headline": one sentence verdict on why this listing is stale and what will fix it.
- Schema field "diagnosis": array of 3 to 5 strings, each a cause plus the evidence from the data.
- Schema field "pricing": 150 to 250 words: which of the three price paths you recommend and why. Name the specific best comparable sales (address, price, $/sf, distance, sold date) that support the number, contrast with the nearest active competition, and reference the estimate, predicted close and days on market; mention search-bracket positioning if relevant.
- Schema field "photoNotes": 60 to 120 words on photo count, lead photo, what to reshoot or reorder, and whether twilight/video/drone would help for this property type and price band.
- Schema field "remarksRewrite": a full rewritten MLS remarks paragraph (900 to 1300 characters) that leads with the buyer benefit, names the incentive or financing hook, and ends with a call to action. Keep the real facts from the existing remarks.
- Schema field "rocketAngle": 50 to 100 words on how a Rocket rate buydown or payment-led message could be marketed for this exact price.
- Schema field "moves": array of 3 to 6 move IDs from the playbook list, best first.
- Schema field "slackPost": a Slack-ready message from the manager to the agent (use emojis sparingly, *bold* for headers, bullets, 150 to 250 words) that summarizes the read, the plan, the price path, the cost of waiting and a clear ask with a deadline.
- Schema field "emailSubject": subject line.
- Schema field "emailBody": a 250 to 400 word email from the manager to the agent in the same voice, ending with an offer to join the seller call.
- Schema field "sellerGuide": a plain-English seller conversation guide the agent can use (300 to 450 words): opening, what buyers see, three paths, cost of waiting, non-price moves, financing lever, close with a decision; include three questions to ask the seller.
- The call uses sample.json with modelTier "default", cache false, optional images, and an onText progress callback; the result is stored as coaching.ai with at and by, and shareouts for slack/email/subject/seller are cleared.

## Early Access Ava prompts (eaPrompts; {me} is the viewer's name or "[Agent name]"; {feats} is the feature list or "what the remarks highlight")
- Shared head block: "Home: {title}, CA {zip}\nPrice: {price} · {beds} bd / {baths} ba · {sqft} sq ft | size n/a[ · {ppsf}/sf] · {type}[ · built {yearBuilt}]\nStatus: {badge}. {status line}.\nLink: {url}[\nListing agent: {agent}]".
- Shared criteria block: "Match criteria (catch the fringes, not just exact hits):\n- Price: {priceMin} to {priceMax}, plus anyone whose max budget is within 5% of {price}\n- Bedrooms: {bedsMin} or more · Bathrooms: {bathsMin} or more\n- Areas: {cities joined by ', '}\n- Property type: {type} · Must-haves to look for: {feats}\n- Also include anyone who searched, favorited or toured in these areas in the last 60 days, and anyone whose saved search would catch this home the day it hits the MLS".
- Prompt "find" (label "Find my matches", who "Any agent · paste into Ava"): "Ava, search my customers, saved searches, favorites and past tours for buyers who fit this Early Access home before it hits the MLS.\n\n{head}\n\n{criteria}\n\nReturn a ranked table: customer name, phone, email, why they match (which criteria hit), last contact date, current stage, pre-approval status (flag Rocket pre-approvals), and the one-sentence opener I should use with each. Then write a two-line text for the top five that says this is Early Access inventory available before the market sees it and asks for a private showing this week."
- Prompt "outreach" (label "Draft the outreach", who "After Ava finds matches · paste into Ava"): "Ava, write buyer outreach for each customer you matched to this Early Access home: one text under 320 characters and one email under 150 words per customer, personalized to what that customer has been searching for.\n\n{head}\n\nWhy it matters to them: {window line} Buyers who move now see it before anyone else.\n\nEach message must include: the link, two concrete selling points ({feats}), that I can arrange a private showing before it goes live, and one clear call to action (reply YES and I will book it). Tone: warm, confident, exclusive, no hype words, no exclamation marks. Sign as {me}, Redfin Powered by Rocket. Return them grouped by customer with the text first, then the email with a subject line."
- Prompt "listing" (label "Listing agent", who "The listing agent · paste into Ava"): "Ava, this is my listing and it has not hit the MLS yet. Help me work it before launch.\n\n{head}\n\n1) Search my customers, past clients and sphere for buyers who match: {criteria line}. Return name, phone, why they match and last contact date.\n2) Search my past clients and sphere within 2 miles of {city or 'the home'} for likely referrers (neighbors, past sellers nearby, anyone who asked about the area) and draft a two-line "coming to your neighborhood before the MLS" text for them.\n3) Draft a four-sentence seller update that covers the pre-market exposure plan, how many matched buyers we are reaching (I will fill the number), the Early Access window, and the feedback we are collecting before launch so we price and present it right on day one."
- Prompt "team" (label "Team broadcast", who "Slack · copy as is"): "🔑 EARLY ACCESS · {badge}\n{title} {zip} · {facts line}\n{status line}.\nWho fits: {criteria line}.\nLink: {url}[\nListing agent: {agent}]\n\nOpen the Early Access tab, copy the Ava prompt under this home, paste it into Ava, and reply here with your matches. Dashboard: {page url}#earlyaccess".
- Prompt "text" (label "Ready text", who "Send to a matched buyer · fill the name"): "Hi [Buyer first name], {me} with Redfin here. I have early access to a home that fits what you have been looking for: {addr} in {city}, {price}, {beds} bd / {baths} ba[, {sqft} sq ft]. {exclusive: 'It is not on the market yet and only Redfin buyers can see it.' | redfin: 'It is only on Redfin.com for the next {left} days before it goes to the MLS.' | 'It has not hit the MLS yet.'} {url} Want a private showing this week? Reply YES and I will set it up."
- Prompt "email" (label "Ready email", who "Send to a matched buyer · fill the name"): "Subject: Early access before it hits the market: {addr}, {city}\n\nHi [Buyer first name],\n\nYou have been looking in {city or 'this area'} around {priceMax K}, so I wanted you to see this one before anyone else does.\n\n{title} · {price} · {beds} bd / {baths} ba[ · {sqft} sq ft][\nHighlights: {features}.]\n{url}\n\n{window line}\n\nI can arrange a private showing before it goes live. If it looks interesting, reply YES with a day that works and I will book it. If it is not quite right, tell me what is missing and I will keep watching the early access inventory for you.\n\n{me}\nRedfin Powered by Rocket".
- Window line (eaWindowLine): exclusive "This is a private Redfin exclusive: it is not on the MLS and only Redfin agents and their customers know about it."; redfin "This is Early Access inventory: it is live only on Redfin.com for the next {left} day(s) before it syndicates to the MLS and every other portal."; other "This is a coming-soon listing on Redfin.com ({badge}); it has not hit the MLS yet."
- Criteria line (eaCriteriaLine): "price {priceMin K} to {priceMax K}, {bedsMin}+ bedrooms, {bathsMin}+ bathrooms, {cities joined by ' / '}, {type}[, looking for {features}]".
- Facts line (eaFacts): "{price} · {beds} bd / {baths} ba · {sqft} sq ft | size n/a[ · {ppsf}/sf] · {type}".

## Early Access weekly share-outs (eaShare, over the filtered set; {wk} is meta.asOf)
- Line per home: "• {title} · {price} · {beds}bd/{baths}ba[ · {sqft} sf] · {badge}[ ({left} days left)][ · {agent}] · {url}".
- Slack post: "🔑 *Exclusive Early Access Inventory · week of {wk}*\n{exclusive} private exclusives · {redfin} Redfin coming soon · {preVolume} before the MLS[ · plus {other} other-brokerage coming soon for your buyers]\n\n*Match these before anyone else sees them:*\n{up to 8 Redfin-inventory lines}[\n…and {n} more on the dashboard]\n\n*How:* open the Early Access tab → copy the Ava prompt under any home → paste into Ava → log your matches and showings on the card. Listing agents: use the Listing agent prompt for your own list and a seller update.\n{page url}#earlyaccess".
- Email digest: "Subject: Exclusive Early Access inventory · week of {wk}\n\nTeam,\n\nHere is this week's exclusive inventory before it hits the MLS: {exclusive} private exclusives and {redfin} Redfin coming-soon homes, {preVolume} in total[, plus {other} coming-soon listings from other brokerages that your buyers can see on Redfin.com first].\n\nPRIVATE EXCLUSIVES (internal only)\n{lines or '• none this week'}\n\nREDFIN COMING SOON (only on Redfin.com)\n{lines or '• none this week'}\n[\nOTHER BROKERAGES COMING SOON\n{lines}\n]\nWhat to do this week\n1. Open the Early Access tab: {page url}#earlyaccess\n2. Copy the "Find my matches" prompt under any home and paste it into Ava.\n3. Send the ready text or email to every match and log matches, outreach and showings on the card so the listing agent can take feedback to the seller.\n\nThe inventory refreshes Sundays and Wednesdays; anything that goes live on the MLS leaves the page automatically.\n\n{viewer name}".
- Printable one-pager: title "Exclusive Early Access Inventory", sub "Redfin Powered by Rocket · Los Angeles · week of {wk} · generated {today}", four counters (private exclusives, Redfin coming soon, pre-market volume, other brokerages coming soon), one table per stage (Badge, Home, Price, Bd/Ba, Sq ft, Window, Listing agent, Who fits, Link) and the footer "How to use: open the Early Access tab on the dashboard, copy the Ava prompt under any home, paste it into Ava to find matching buyers, send the ready text or email, and log matches, outreach and showings on the card. Private exclusives are internal only; Redfin coming soon is live only on Redfin.com for up to 21 days before the MLS."

## Playbook seller scripts (playbook.scripts, verbatim)
- "Tom Ferry: alignment" (tomferry.com, TomFerryShow episode 173): "Right now the agents in the market, the data, and the buyers are telling us the price isn't aligned. What would you like to do? I'm going to strongly recommend we amend the price to be in alignment with what buyers are willing to pay. For 90 days, buyers have compared your home to other homes from $__ to $__ and didn't like your home enough to make an offer."
- "Brian Buffini: the market renews" (blog.buffini.com/price-reductions): "Every 21 days the real estate market renews and readjusts itself. I've prepared an updated market analysis. When can we meet? The market is telling us we're priced a little on the high side. If we adjust the price downward, we'll be taking a major step in the right direction."
- "Byron Lazine: 10-10-0 call" (BAM, June 2026): "As promised, quick update. We're at [X] days on market, [Y] total showings, and so far the market has given us no written reaction. When we listed, we agreed on the 10-10-0 rule. We're at that point now. My recommendation is that we adjust the price to [number] so we move from being shopped to being chosen."
- "Saad Jamil: showings prove marketing" (Jamil Academy price reduction scripts): "Eleven showings show marketing works. Zero offers means buyers like the home but not at this price. Buyers watch days on market like we watch comps. Past day 30, they assume something's wrong. One decisive reduction stops the bleeding. Objection, wait until spring: spring brings more inventory and buyers who already saw your home at the current price."
- "Tim and Julie Harris: second launch" (timandjulieharris.com, Aug 2026): "This is a second launch, not a price change. You contribute through price, I contribute through execution: new lead photo, new copy, new social, a second open house with every prior showing invited, and a written report every week."
- "Aaron Novello: six phrases" (HomeLight agent podcast): "Fair market value. The marketplace is showing us. Through no fault of your own or mine, marketplace dynamics have changed. Price is a snapshot in time. My job is to help you, never to talk you into anything. Whatever you decide, I'll support you 100%."
- "Redfin voice" (Redfin News, 2019 and March 2026): "Fair or not, buyers judge a home by how many days it has been on the market. Nine times out of 10, homes are selling for under asking; sometimes the price is just too high and sellers pull the home after six months."

## Coach resource lines (playbook.coach, verbatim)
- Principle: "A list price is a marketing price, not a promise. The goal is not to defend a listing at all costs. The goal is to earn showings, gather market feedback, and position the property so buyers feel compelled to act."
- Bottom line: "Stale listings are usually not a mystery. They are a feedback loop. If buyers are not coming, the listing is telling you to adjust the price, the presentation, or the positioning."
- Driver price: desc "The property is above what buyers will accept for the condition, location, or competition."; line "Price it to market it, not to marry it."; sellerLine "Price is not just a number. It is a marketing tool. If the listing is not getting activity, we may need to position it more aggressively to create attention and urgency."; question "Are we pricing for ego or for activity?"
- Driver presentation: desc "The photos, staging, order of photos, and overall visual story are not compelling enough."; line "Does this listing earn the right to be toured?"; sellerLine "Sometimes the issue is not the home itself, it is how the home is being presented online. Buyers decide very quickly, and the first few photos matter a lot."; question "What is the first impression problem?"
- Driver perception (label "Location / Perception"): desc "Buyers may be reacting to street view, hillside or fire risk, alley access, neighborhood naming, or other perceived risks."; line "Remove or minimize what triggers fear; lead with what builds trust."; sellerLine "Buyers react to what they see first: street view, map view, and how the neighborhood is labeled. We can control how the home is framed."; question "What will scare a buyer away before they read the remarks?"
- Driver process: desc "The listing is drifting: no plan, no weekly reset, no direct seller conversation."; line "Do not let the listing drift. Reassess quickly, talk to the seller sooner rather than later."; sellerLine "The first one to two weeks are the most important window. If the home is not getting traction, we adjust quickly rather than let days on market keep building."; question "What is the smallest change that could increase showings?"
- Scripts opening: "I want to be direct with you: the market is giving us a clear signal." / "Right now, we need to focus on what will get more buyers through the door." / "Our job is not just to list the home, it is to position it so buyers respond."
- Scripts price: "Price is one of the main levers we control." / "The goal is not to lower the price for the sake of it. The goal is to create activity." / "If buyers are not reacting, the market is telling us the price may be too high for today." / "We do not have to accept a lower price, but we do need to earn attention."
- Scripts presentation: "Sometimes the issue is not the home itself, it is how the home is being presented online." / "Buyers decide very quickly, and the first few photos matter a lot." / "We may not need a full makeover, but we may need a stronger visual story." / "A partial staging refresh could make the home feel warmer and more current."
- Scripts relaunch: "If we make meaningful changes, it may make sense to reset the listing and relaunch." / "A fresh launch can help us get a new round of attention." / "That is not a failure. It is a strategy adjustment."
- Scripts urgency: "The first 1 to 2 weeks are where we usually get the strongest response." / "If we let the listing sit too long without changes, it gets harder to recover." / "I would rather adjust early than let days on market build up."
- Scripts alignment: "I want to be the right agent for you, and that means being honest about what the market is saying." / "If we stay aligned, we can make the strongest move possible." / "I want to sell your house, not just list it."
- Objection "price": say "We don't want to lower the price."; respond "That's understandable. Price reductions are never fun. But if the market is not responding, price is one of the main levers we can control. A better price can create the activity that gets us the strongest overall result."
- Objection "worth": say "The house is worth more than that."; respond "It may be in the right condition or location to justify that price someday, but today the market is telling us what buyers are willing to pay right now. Our job is to respond to today's demand, not yesterday's expectations."
- Objection "photos": say "We think the photos are fine."; respond "The question is not whether they are acceptable. The question is whether they are helping the home get showings. If buyers are not clicking or touring, we need to improve the visual story."
- Objection "staging": say "We don't want to stage the home."; respond "You may not need full staging. Often, partial staging is enough to make the property feel warmer, more current, and more appealing. The goal is to help buyers imagine themselves living there."
- Objection "relaunch": say "We don't want to take it off the market."; respond "That's fair. But if the current approach is not producing results, relaunching with a cleaner strategy can help reset buyer interest. Sometimes a fresh start is the smartest move."
- Objection "market": say "The market is just slow."; respond "The market may be slower overall, but buyers are still active for the right homes. If similar homes are getting traffic and this one is not, then we need to look at what is different about this listing."
- Objection "money": say "We don't want to spend more money."; respond "That's understandable. The question is whether a small investment now can help avoid a much longer time on market and a weaker final outcome later. Sometimes a modest adjustment saves the seller money in the long run."
- Firm lines: "If you don't want to do these things, I may not be the right fit." / "I want to sell your house, not just list it." / "If we stay aligned, we can win. If not, we should part ways."
- Seller guidance goal: "Our goal is simple: get more qualified buyers through the door, create stronger interest, and give the property the best chance to sell."
- Seller guidance whyItMatters: "The first 1 to 2 weeks are the most important window. If the home is not getting traction then, we need to adjust quickly rather than let days on market keep building."
- Seller guidance honest: "If a home is not drawing attention, it is usually telling us something. The smartest next step is to respond to the market, not fight it. If you are open to it, we can walk through the pricing, photos, and presentation together and decide the best next move."
- Seller guidance buyersRespondTo: "the first few photos", "the order of the photos", "whether the home feels updated, clean, and inviting", "whether the price feels believable", "whether the property creates any concerns from street view, map view, or location perception".
- Seller guidance howWeThink: "good first impression", "strong photos", "realistic pricing", "clear buyer appeal", "fewer reasons for buyers to hesitate".
- Coach pricing lines: "Lower pricing brings more eyes, more showings, a better chance of multiple offers, and stronger leverage for the final negotiated price." / "Pricing too low only works if the home also looks sharp. A bad presentation plus a low price can still fail." / "Low pricing is a strategy, not a commitment. It does not force acceptance of a low offer." / "Be honest about what the market is saying now, not what the seller hopes it will say."
- Coach photoRules: "Put the best kitchen photos together near the front." / "Keep the photo order logical and flowing, like a walkthrough." / "The first photos should hook interest quickly." / "Remove random office spaces, odd furniture placements, clutter, dated details, repeated angles, and views that trigger fear." / "Show only what helps the listing: desirable, understandable, easy to imagine living in." / "Fix AI or editing artifacts: awkward lines, dash marks, artificial copy."
- Path A "Path A: Price problem": "Reprice aggressively enough to create urgency", "Reorder photos so the strongest visuals lead", "Improve copy and remarks", "Relaunch if needed".
- Path B "Path B: Presentation problem": "Partial staging in the living room, primary bedroom and patio", "New photography", "Remove weak or distracting images", "Tighten the visual storytelling".
- Path C "Path C: Perception problem": "Remove scary visuals (street view, aerials that trigger fear)", "Adjust neighborhood framing and labeling", "Improve map and syndication accuracy", "Lead with stronger interior shots".
- Path D "Path D: Full reset": "Take it down briefly", "Restage", "Reshoot", "Refresh price and positioning", "Relaunch cleanly".
- Tests, questions, staging, buyerObjections, buyerNeeds, marketReality, steps, sellerChecklist and earlyAccess arrays are rendered on the Playbook tab (tests, questions, paths, objections) or sent to Claude (tests, staging) exactly as stored in playbook.json.

## Market talking points (market.talkingPoints, verbatim)
- Under $750K: "Still the healthiest band: Victorville, Lancaster and Palmdale sell above list 46 to 53% of the time in 38 to 55 days (Aug 2026). Buyers here are the most rate sensitive: 0.5 point is $165 to $205 a month on a $600K to $750K purchase." / "Price-drop shares in these cities run 32 to 37%, double LA County's 17%. A sub-$750K listing at 60+ days with no offers is almost always price or condition, not the market." / "Yucca Valley is the exception: 77 DOM, 96.8% sale-to-list, 36.7% price drops. FAIR Plan insurance rises 29.1% on Oct 15. Get an insurance quote before relisting." / "Condos: LA County condo Expected Market Time is 188 days versus 117 for detached. HOA dues plus insurance hit the payment-constrained buyer hardest."
- $750K to $1.5M: "This is the county median (LA $922K to $947K, Ventura $867K to $925K). Buyers here lost roughly $80K to $130K of purchasing power since July on the same payment and usually have no cash cushion." / "Ventura County shows the softest data of the four counties: sales down 11.9% year over year, median down 1.3%, 21.4% of listings with price drops. Do not use OC's appreciation as a reference." / "OC under $1M moves in 45 days, so a stale OC condo or entry home is a pricing issue. 43% of OC actives have cut; median list ($1.725M SFR) sits far above median closed ($1.41M)." / "Script: The buyers who toured in August were qualified at 6.7%. The same buyers are qualified today for about 5% less house. We can meet them or wait for the next group, which the data says is smaller."
- $1.5M to $3M: "Jumbo rates are 7.27 to 7.66%, so the payment on a $2M home moved from about $10.4K to $10.9K in six weeks before taxes and a rising insurance bill. OC $2M+ takes 58 days versus 39 for $1M to $2M." / "LA County's $2M+ segment has an Expected Market Time of 258 days, nearly twice the county average. Last year's band table showed $2M to $3M at 149 days and $3M to $4M at 222; expect worse now." / "Cash buyers (27% of sales nationally) are the leverage. A cash-ready price beats a financed-buyer fantasy price." / "Beverly Hills study: homes priced within 3% of value closed in 29 days at 99.1%; homes that needed a reduction averaged $342K below original list and 73 days. A stale listing here has usually already lost more than the reduction it resisted."
- $3M+: "Discounts are the norm: 14% and 42% under-ask closings reported in Beverly Hills; Malibu absorption 12%. The 2025 band table had $4M to $8M at 309 days and $8M+ at 593." / "Measure ULA still takes 4% at about $5M and 5.5% at about $10M inside LA city, a $200K to $550K haircut that Beverly Hills or Santa Monica comps do not carry." / "The 10-year at 5.3% matters twice: jumbo rates and the opportunity cost of parking cash. Treasuries paying 5% risk-free compete with the house; the listing needs to be finished, private and turnkey." / "Insurance is a closing risk: FAIR Plan premiums in high-fire zones may double on Oct 15 renewals. Get a bindable quote into the disclosure package." / "Seller over 55 moving down: Prop 19 lets them carry the old tax base to any California replacement home up to three times, which often matters more than the last 3% of price."
- The market narrative (market.narrative, four paragraphs beginning "Here is what changed in the last six weeks. Mortgage rates went from 6.65% in late August to 7.28% on October 1…" and ending "…the one option that is closing is the price from May.") is rendered verbatim on the Market tab and sent to Claude; the full text lives in data/market.json.
- The playbook "pricing" rules, "relaunch" rules, "stats", "diagnostics" and "tierPlays" are rendered verbatim from data/playbook.json on the Playbook tab (see that file for the full text; the move list is reproduced in section 2 by id and the tier postures in section 3).

## Coaching moves (playbook.moves, verbatim; these override the page's DEFAULT_MOVES)
- PRICE_ADJUST (Price) "Price adjustment (one decisive move)": "One 3 to 7% adjustment (7 to 10% past 45 days) framed as a second launch. Replace multiple small cuts with one that re-ranks the home."
- PRICE_BRACKET (Price) "Reposition on a search bracket": "Price so the home appears in the next buyer search band: just under the band below $1M ($999K), on the round number at $1M+ so both filters catch it."
- THURSDAY_DROP (Price) "Thursday drop": "Post the adjustment Wednesday night or Thursday to hit hot sheets and weekend tour planning. Pair it with new lead photo and copy."
- RATE_BUYDOWN (Financing) "Rocket 2-1 buydown offer": "Seller-funded temporary buydown advertised in remarks with the year-1 monthly savings. Costs about 2.3% of the loan and cuts the buyer's payment far more than the same dollars as a price cut."
- PERMANENT_BUYDOWN (Financing) "Permanent rate buydown": "Seller-paid points (about 1% of loan per 0.25% rate) marketed as a lower lifetime payment through Rocket."
- BUYER_INCENTIVE (Financing) "Closing-cost credit": "Fixed-dollar credit stated in remarks within loan-type caps (conventional 3 to 9%, FHA 6%). Concessions appear in 54.8% of LA sales already."
- PHOTO_REFRESH (Presentation) "Photo refresh": "Reshoot or re-edit to 25+ pro photos. Strongest exterior leads, best five features in the first five frames, cut dark or vertical shots."
- TWILIGHT_VIDEO (Presentation) "Twilight, floor plan, 3D and video": "Add a twilight hero, floor plan and 3D tour (Zillow: 3D-tour listings sell 14% faster) plus a 60 second walkthrough."
- REMARKS_REWRITE (Presentation) "Remarks rewrite": "Lead with the top three features from showing feedback and buyer search keywords (garage, walk-in closet, family room). State the incentive. Remove distress words like motivated or won't last."
- STAGING (Presentation) "Staging reset": "Stage living room, primary bedroom and kitchen, or declutter and neutralize. 49% of listing agents report less time on market with staging."
- PRE_INSPECTION (Condition) "Pre-inspection and repairs": "Order a pre-listing inspection, fix the recurring feedback items, publish the report to cut fall-through risk before any relaunch."
- SHOWING_ACCESS (Exposure) "Access unlock": "Remove notice requirements, add a lockbox or instant confirm, widen windows. Buyer agents drop hard-to-show homes from tours."
- OPEN_HOUSE_BLITZ (Exposure) "Relaunch open house": "Public open house at the new price inviting prior showings, neighbors and the database; back-to-back weekend opens."
- BROKER_OPEN (Exposure) "Broker open and showing-agent callbacks": "Agent-only preview to collect written pricing and condition feedback; call every agent who showed and every agent on nearby pendings."
- REVERSE_PROSPECT (Exposure) "Reverse prospecting and reverse offer": "Query CRMLS saved searches that match the new price and send the listing directly; send written terms to anyone who toured twice or lowballed."
- SOCIAL_PUSH (Exposure) "Paid social and email push": "Targeted ads to the price band and feeder zips; feature in the weekly buyer email and Nextdoor."
- FEEDBACK_LOOP (Process) "Weekly written seller report": "Showings, feedback, inquiries, open house results, new comps and Redfin traffic every week so the data makes the ask, not the agent."
- RELAUNCH (Process) "Withdraw and relist (30-day reset)": "Written seller instruction, off CRMLS 30+ days (CDAM resets after 30 days off-MLS since Nov 2025), fix something material, relist under a new number. Disclose cumulative DOM honestly."
- SELLER_CONVERSATION (Process) "Cost-of-waiting seller meeting": "Face to face with carrying cost plus the discount curve versus a one-time adjustment. Offer three paths and get a decision."
- EXPIRATION_PLAN (Process) "Expectation reset and exit plan": "Address the expiration date; document the seller's decision; set an extension or cancellation path."
- NO_CHANGE (Process) "No change (with reason)": "Document why the listing stays as is and the date it will be reviewed again."
- The page's embedded DEFAULT_MOVES (used only when playbook.moves is empty) has 18 entries with the same ids minus THURSDAY_DROP, PERMANENT_BUYDOWN and REVERSE_PROSPECT, with shorter labels such as "Rocket rate buydown offer", "Buyer incentive or concession", "Twilight, drone or video", "Staging or declutter", "Open up showing access", "Open house blitz", "Broker open and agent outreach", "Collect showing feedback", "Relaunch (withdraw and relist)", "Seller strategy meeting" and "Listing agreement extension".
- A move id that is not in the active move list renders with its id as the label and an empty description.

# 15. Share-outs and exports

- All downloads go through the artifact "downloads" capability (S.downloads.save({filename, data})); when it is missing, HTML content is copied to the clipboard instead ("Downloads unavailable here; HTML copied") and other formats toast "Downloads are not available in this view"; a declined save is silent; other failures toast "Could not save the file: …".
- Clipboard copies use navigator.clipboard.writeText with a textarea/execCommand fallback and toast "Copied" or "Select the text and copy it manually".

## Recommendation Studio assets (property page, Step 3)
- Filename stem: "{studio title or address with non-alphanumerics replaced by '-', max 60 chars}-{today}".
- "Create PDF": renders assetHTML into a hidden 816 px iframe, captures it with html2canvas (scale 1.5, white background), pages it into a jsPDF letter document (JPEG slices at quality 0.9) and saves "{stem}.pdf"; toasts "Rendering PDF…" then "PDF saved".
- "Create web page (.html)": saves assetHTML as "{stem}.html" ("Saved").
- "Preview": renders assetHTML into an inline 700 px iframe.
- assetHTML contains: header with brand "Redfin Powered by Rocket", the title, "{tag} · Prepared for {for} by {by} · {date}", tier pill "{Tier} · {dom} days"; then each included section (headline as a paragraph; photos as a 5-column grid with the first as hero; objections as bold say + respond; pricing as band cards for the ticked paths with label, price, "{cut} · {cutPct}% · ~{pay}/mo", "Who it fits" and a rationale paragraph per path; comps as a linked table (Sold comp, Price, $/sf, Sq ft, Bd/Ba, Dist, Sold) when compsOn; newcomp as a linked table (New listing (last 30 days), Price with ▼ when cheaper, $/sf, Bd/Ba, Sq ft, Dist, DOM) up to 12; cost as the day 0/30/60/90 table); footer "Prepared with Redfin's Sold Standard (Redfin Powered by Rocket). Market context as of {market.asOf}. Figures are planning estimates, not appraisals."
- "Create in Gmail ↗": opens https://mail.google.com/mail/?view=cm&fs=1&su={subject}&body={email text}; the subject defaults to "{title}[ · {tag}]"; blocked by unresolved studio issues.
- "Copy email": copies "Subject: {subject}\n\n{body}"; "Create and copy for Slack": copies the Slack asset text.
- "Create spreadsheet (.xlsx)" (SheetJS, bookType xlsx): sheets "Summary" (Title, Prepared for, Prepared by, Date, Address, Agent, Days on market, Tier, List price, Original price, Redfin Estimate, Predicted close, Best-comp value, Blended market value, Gap to market %, Listing health, Primary driver, Recommended path, then a "Section / Text" table of included sections), "Pricing paths" (Path, Price, Cut $, Cut %, $/sf, Buyer P&I /mo, Competitors still cheaper, Who it fits, Rationale), "Best comps" (up to 10), "New competition 30d", "All competition" (each with Address, City, Price, $/sf, Sq ft, Beds, Baths, Year built, Distance (mi), DOM, Sold date, Match score, Link), "Action plan" (#, Move, What it means, Owner, Due, Status); saved as "{stem}.xlsx" ("Spreadsheet saved").
- "Create comps file (.csv)": rows with Type ("Best comp" or "New competition"), Address, City, Price, $/sf, Sq ft, Beds, Baths, Distance (mi), DOM, Sold date, Link; saved as "{stem}-comps.csv" ("CSV saved").
- "Log as sent" / "Log as shared" append {channel: slack | email | pdf | spreadsheet, at, by} to coaching.sent and toast "Logged".

## Listing Health Report (reportHTML; defined but not reachable from the current UI)
- Filename "Listing-Health-{address slug}-{today}.html" or ".pdf"; same PDF pipeline as the Studio.
- Content: brand header, address, "Listing Health Report · {agent} · prepared {date}", tier pill and "{score}/100 health"; KPI boxes List price (was …), Redfin Estimate, Predicted close, vs blended market value; "On Redfin.com" photo grid of up to 11 with a caption of photos, remarks length, Hot flag, open house and latest engagement; "Competition within {radius} mile(s)" paragraph and table of up to 8 actives; "Best comparable sales" table with Match score and the note "Best-comp value … (score-weighted). Match score weighs size, beds and baths, distance, recency and property type."; "Diagnosis" list; "Pricing paths" cards and rationales; "Action plan" ordered list with Owner/Due/Notes; "Cost of waiting" table with the assumptions sentence "Assumptions: {rate}% rate, {down}% down, carrying {carryPct}%/yr, market drift {driftPct}%/mo, stale discounts {discStale}/{discUltra}/{discExtreme}%, closing costs {closingPct}%. Edit these in the dashboard."; footer "Prepared with Redfin's Sold Standard. Market context: {market.asOf}. Figures are planning estimates, not appraisals."

## Early Access share-outs (Early Access tab, over the filtered set)
- "⧉ Slack post": copies the Slack text (toast "Slack post copied").
- "⧉ Email digest": copies the email text (toast "Email digest copied").
- "⬇ Printable one-pager": saves eaOnePagerHTML as "Early-Access-Inventory-{meta.asOf}.html" (toast "One-pager saved; open it and print").
- "⬇ Sheet (for Google Sheets)": saves an xlsx (SheetJS) as "Exclusive-Early-Access-Inventory-{meta.asOf}.xlsx" (toast "Sheet saved; import it into Google Sheets") with sheet "Early Access" (title row "Exclusive Early Access Inventory · week of {wk}", blank row, header Stage, Badge, Address, City, Zip, Area, Price, Beds, Baths, Sq ft, $/sf, Year built, Days in Early Access, Days used, Days left, Listing agent, Who fits, Features, Redfin link, Deal room, Map, First seen, Checked; column widths 12,22,28,16,8,16,12,6,6,8,8,8,10,8,8,20,60,24,40,40,40,12,12) and sheet "Ava prompts" (Home, Ava: find my matches, Ready text) for Redfin inventory only.

## Other copies
- "Copy link to this property" copies the deep link; "Copy remarks" copies coaching.ai.remarksRewrite; every Early Access prompt button copies its text and counts the copy.

# 16. Pipeline behavior

## Common
- All scripts live in pipeline/ and resolve ROOT as the repo folder (the parent of pipeline/).
- HTTP requests use a desktop Chrome User-Agent, 30-second timeout and 3 retries with sleeps of 1.5, 3.0 and 4.5 seconds (function get); stingray() strips a leading "{}&&" and returns the JSON "payload".
- Push batches are JSON arrays of {op, collection, doc_id, file_path[, if_version]} (or {op:"delete", collection, doc_id, if_version}) sized to at most 50 writes and 980,000 bytes of file content per batch.
- Version pins: a write for a key already in versions.json carries if_version = that version; --bump increments every written key by 1 (and deletes removed keys) and rewrites versions.json; the intended cycle is pin, push, then run again with --bump to record the new versions.
- Claude pushes the batches with the ArtifactData batch tool after each script run (README "Weekly cycle").

## fetch_listings.py (CSV -> Redfin enrichment -> snapshot)
- Arguments: --csv (required), --asof (default today ISO), --limit N (smoke test; first N rows), --no-photos, --out (default data/snapshots/<asof>.json), --refresh-core, --cache-days (default 6).
- For each row it calls enrich(row) then shape(row, raw) and prints "[i/n] {dealId} {address}, {city} dom={dom} -> ok|skip|?? {error}", sleeping 0.4 s between rows; the snapshot is {asOf, count, records}.
- Cache rules: data/raw/<dealId>.json is reused when fetchedAt is within cache_days of asof; with --refresh-core a cached row whose fetchedAt differs from asof is re-pulled while keeping gisActive, gisSold, gisFetchedAt, thumbs, simListings and simSolds.
- Resolution: the address (without unit "#/Unit/Apt/Ste" suffix) is tried via /stingray/do/location-autocomplete?v=2&location=… in this order: "{addr} {city} {state}", "{base} {city} {state}", "{base} {suffix} {city} {state}" for suffixes St, Ave, Rd, Dr, Ln, Way, Blvd, Ct, Pl, Cir when no suffix is present, "{base} {city}", "{addr} {state}", "{base} {state}", "{base} {suffix} {state}", "{base}", variants without a directional prefix (N/S/E/W) and with only the first number of an address range; the first autocomplete row of type 1 with a url wins; 0.2 s between tries.
- Listing page fetch: parses "listingId", "propertyId", the remarks (listingRemarks div or marketingRemarks JSON) and the "Listed by" agent name from the HTML.
- Endpoints: /stingray/api/home/details/aboveTheFold?propertyId=…&listingId=…&accessLevel=1, /stingray/api/home/details/belowTheFold (same query), /stingray/api/home/details/similars/listings and /similars/solds (only when a listingId exists and not kept from cache), with 0.25 s sleeps.
- Photos: the first 8 photos' nonFullScreenPhotoUrlCompressed (or nonFullScreenPhotoUrl or thumbnailUrl) are downloaded and encoded (first at width 560 quality 72, rest at 220/60) with 0.15 s sleeps; a failed photo stores {"error": …}.
- Failure handling: an exception stores raw.error = "{ExceptionType}: {message}"; when the fresh pull has an error and a previous cache with a url exists, the previous cache is restored with staleFetch = asof and staleError = the error so a block never erases good data.
- Stage 2 (runs even for cached rows): when the cached payload has a latitude and no error, the gis radius searches run once (gisActive, gisSold, gisFetchedAt; failures store gisError) with a 0.3 s sleep, and the thumb set is filled up to min(15, available photos) when fewer are cached.
- Photo processing needs Pillow; without it photos are skipped.
- shape() builds the record as described in sections 2 and 5; records without addressSectionInfo get redfin {ok:false, error}.

## seed_db.py (snapshot -> db documents + manifest)
- Arguments: --snapshot (required), --prev (previous snapshot json), --prev-db (previous data/db/<date> folder, preferred).
- Steps: load previous listings (and meta.json) from --prev-db or records from --prev; delete and recreate data/db/<asOf>/ with listings/ and photos/; for each record merge history, carry forward the previous week's redfin block and photo document when this week's pull is not ok but last week's was (adding carriedFrom and carryReason and dropping "Redfin" data issues), shrink and move thumbs into photos/<id>.json, compute change lists, write listings/<id>.json; compute gone; write week.json, meta.json; copy data/playbook.json and data/market.json into the folder; write manifest.json listing every document with collection, doc_id and file.
- Batches: batch00.json… in batches/ for every manifest entry except playbook and market; a photos document whose thumb count equals last week's is skipped ("skipped N unchanged photo docs"); it prints the batch count.
- It writes push-context.json with prevIds, prevPhotoIds and the versions map loaded from <prev-db>/versions.json (that file does not exist, so versions is {}); the actual pins are added later by pin_batches.py.
- It prints document count, largest document size, enriched/unresolved counts and change counts.

## pin_batches.py (adds version pins)
- Arguments: --db (the week folder), --versions (data/db/versions.json), --bump.
- It processes batches/batch*.json except batch-ea* (which early_access.py pins itself); for "delete" ops it adds if_version when the key is known and removes the key on --bump; for other ops it sets if_version from the map or removes any stale pin for new keys; with --bump every written key is incremented by 1 and the map is saved (sorted keys).
- It prints "{n} batches: {pinned} pinned, {new} new (versions bumped)".
- batch-oh*.json files written by openhouse.py are also pinned by pin_batches.py when it runs after them (they match batch*.json). UNVERIFIED (the intended order is openhouse.py pins them itself; running both would double-bump)

## openhouse.py (open house sheet -> openhouses/ docs + weekly rollup)
- Arguments: --csv (required), --db (required, the listing week's folder), --events, --sheet-date (default: the YYYY-MM-DD in the csv filename, else meta.asOf), --versions (default data/db/versions.json), --bump.
- Steps: read meta.json for asOf; load every listing in <db>/listings; read the events export; read the sheet with forward fill; build one row per sheet line; merge duplicates by deal id (summing counts and cost); attach listing fields and the active flag; attach events, hosts and hostNames; delete and rewrite <db>/openhouses/*.json; compute ohweek.json; write oh-manifest.json; write size-aware pinned batches batch-oh00.json… (deleting older batch-oh*.json first); with --bump update versions.json.
- It prints "{n} open house deals ({active} active, {opens} opens, ${cost} est. spend, {paid} paid opens); {k} active 60+ listings with no record; events loaded: {bool}; {b} batch file(s) in {dir}".
- The README cycle: run once to produce batches, push batches/batch-oh*.json, run again with --bump to record versions.

## early_access.py (exclusives + Redfin.com coming-soon crawl -> earlyaccess/ docs + weekly rollup)
- Arguments: --exclusives (required), --db (required), --prev-db, --no-crawl (reuse the latest data/raw/ea/crawl-*.json), --no-photos, --versions (default data/db/versions.json), --bump.
- Steps: read meta.asOf; index this week's listings by normalized address; load last week's earlyaccess docs (from --prev-db, else the same folder); crawl (or load the cached crawl) and save crawl-<today>.json; add listing cities to the centroid map; read the sheet and build sheet docs (check_exclusive with 0.4 s sleeps, photos, stage rules); add crawled homes not in the sheet; fetch photos, remarks and agent for crawled Redfin coming-soon homes (0.5 s sleeps); compute firstSeen, stage changes, days, clock, nearby cities, fingerprint and features; delete and rewrite <db>/earlyaccess/*.json; write eaweek.json and ea-manifest.json; write pinned batches batch-ea00.json… plus delete batches for gone homes; with --bump update versions.json.
- The crawl prints "  {city}: page 1, {n} homes, {cs} coming soon" per city and sleeps 0.4 s per page and 0.3 s per city; a failed city prints the error and continues.
- A mid-week run (Wednesday) keeps the 21-day clock current; --no-photos is faster.
- It prints "{n} Early Access docs: {e} private exclusives, {r} Redfin coming soon, {o} other brokerages, {g} graduated to live; {b} batch file(s), largest doc {kb} KB".

## Weekly cycle (README)
- Step 1: export the sheet to data/weekly/<date>.csv (or upload it in the Weekly upload tab).
- Step 2: python3 pipeline/fetch_listings.py --csv data/weekly/<date>.csv --asof <date> --refresh-core.
- Step 3: python3 pipeline/seed_db.py --snapshot data/snapshots/<date>.json --prev-db data/db/<previous date>.
- Step 4: push data/db/<date>/manifest.json batches with ArtifactData (50 documents per call).
- Step 5: refresh data/market.json rates and stats; push as market/current.
- Step 6: python3 pipeline/openhouse.py --csv data/weekly/openhouse-<date>.csv --db data/db/<date> [--events …]; push batches/batch-oh*.json; run again with --bump.
- Step 7: python3 pipeline/early_access.py --exclusives data/weekly/exclusives-<date>.csv --db data/db/<date> --prev-db data/db/<previous date>; push batches/batch-ea*.json; --bump after the push.
- Sending Claude the new sheet links (listings + open houses + exclusives, Sundays) runs steps 1 to 7.

## Removal batch (batch-gone.json, built outside the scripts)
- After seed_db.py, Claude runs this snippet from the stale-listing-dashboard folder to mark the listings that left the sheet (one "update" per gone deal, pinned to the current version): python3 - <<'EOF' / import json / db="data/db/<date>"; meta=json.load(open(f"{db}/meta.json")); vers=json.load(open("data/db/versions.json")) / b=[{"op":"update","collection":"listings","doc_id":i,"data":{"status":"Removed from sheet","removedAt":meta["asOf"]},"if_version":vers.get(f"listings/{i}")} for i in meta["changes"]["gone"] if vers.get(f"listings/{i}")] / json.dump(b, open(f"{db}/batches/batch-gone.json","w"), separators=(",",":")) / EOF
- pin_batches.py then re-pins and, with --bump, bumps the versions of the documents in batch-gone.json like any other batch.

# 17. Known gaps and UNVERIFIED items

- data/coach.json duplicates playbook.coach and is read by no script; its role is UNVERIFIED.
- docs/MASTER-REBUILD-PROMPT.md is a rebuild prompt written after the code and is not a source of truth for this specification.
- batches/batch-gone.json (listing "Removed from sheet" updates) is not produced by any pipeline script; Claude builds it each week with a one-off Python snippet from meta.changes.gone and versions.json (documented in DATA-REFRESH.md step 5) and pushes it with the other listing batches.
- pin_batches.py re-pins batch-oh*.json after openhouse.py pinned them (same result) and, with --bump, records their versions; therefore run either pin_batches.py --bump or openhouse.py --bump after a push, never both, or open house versions are bumped twice.
- The share panel (Slack message, Email, Seller guide, Health report) and the Listing Health Report download are defined in code but not rendered by any view, so they are unreachable from the UI.
- The AI panel says Claude's agent message and seller guide feed the Studio, but the Studio's default sections never read coaching.ai (only the unreachable share panel does).
- resolveNames() only runs when S.ptab is "notes", a value no control sets, so team notes never resolve user ids to names; notes are saved with name "" and render as "Someone".
- The Early Access filter hint reuses the Open Houses one-time flag (S.ohHint), so whichever of the two tabs is opened first gets the shimmer.
- README says photos documents hold "up to 8 thumbnails"; the code stores up to 15.
- The README's clock description (green 0 to 7, amber 8 to 14, red 15 to 21) matches the pipeline for coming-soon homes, but the page uses 14/30-day bands and a 45-day bar for private exclusives.
- market.affordability, market.news, market.notFound, market.driftPctPerMonth, playbook.photoRubric, playbook.financing, playbook.intro and playbook.version are stored but never rendered.
- The analysis flag "expiring" has no lower bound, so already-expired listings are flagged; the Overview expiring card and week.expiring45 require daysToExpiration >= 0.
- The diagnosis "Slightly above market with no urgency signal" is attributed to the "process" driver because its cause text matches none of the price/presentation/perception regexes.
- The open house alert "oh-zero" can only fire for an active 60+ listing whose sheet row has zero opens, which the sheet (deals past the norm) never contains in practice.
- The page's upload tab writes listings one document at a time with no version pins, so a later pipeline push must re-read versions. UNVERIFIED
- managerOf(agent) is a stub that returns "" and is unused.
- The Hot Home Score sheet column is a probability in the data (for example 0.3838…) but is only treated as hot when it is exactly "1", so hotHome is false for every row at handoff (week.hot is 0).
- Listings whose Redfin block is carried forward keep last week's competition and photo counts while history[] records newerCompetitors and photoCount as null for that week.
- The event-level open house export has never been loaded, so hosts, hostNames and events fields are UNVERIFIED in live data.
