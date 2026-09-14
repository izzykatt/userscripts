## What it does

**LeoList, reduced to the listings.** Works on **every category** — personals, dating, jobs, services, community, rentals — and every region. It removes; it never adds.

**1. The gate** — decided per page, from the DOM, never from the URL:

```
┌───────────────────────────────────────────────┐                        
│                any leolist page               │                        
└───────────────────────┬───────────────────────┘                        
                        │                                                
                        ▼                                                
┌───────────────────────────────────────────────┐                        
│a listing index with at least one real listing?│                        
└───────────────────────┬───────────────────────┘                        
                        │                                                
                        ├────────────────────────────────────┐           
                        │                                    │           
                       yes                                  no           
                        │                                    │           
                        ▼                                    ▼           
┌───────────────────────────────────────────────┐ ┌─────────────────────┐
│LISTINGS ONLY: the listing column, nothing else│ │untouched, 100% stock│
└───────────────────────────────────────────────┘ └─────────────────────┘
```

**2. A qualifying index** becomes:

```
┌────────────────────────────────────────────┐
│    listing rows, sponsored ones dropped    │
└──────────────────────┬─────────────────────┘
                       │                      
                       ▼                      
┌────────────────────────────────────────────┐
│filters and cities behind one corner control│
└──────────────────────┬─────────────────────┘
                       │                      
                       ▼                      
┌────────────────────────────────────────────┐
│                 pagination                 │
└────────────────────────────────────────────┘
```

- **Kept:** the listing rows, pagination, and the site's own filters/cities — relocated into one corner control, still working
- **Dropped:** sponsored rows and the sponsored strip, the safety-tips aside, the human-rights banner, the sticky side rail, the footer, the hover popup
- **Dark by default**, on every page, whether or not the gate passes

**3. An ad's own page** gets its photos as a filmstrip:

```
┌──────────────────────────────────────────────────┐
│                the ad, as written                │
└─────────────────────────┬────────────────────────┘
                          │                         
                          ▼                         
┌──────────────────────────────────────────────────┐
│every photo as one filmstrip, no lightbox clicking│
└──────────────────────────────────────────────────┘
```

Every photo the ad carries, laid out to scroll — instead of opening the lightbox and clicking through one at a time. The description is kept as written.

## What it does not do

- no scraping, no downloading, no contacting anyone, no automation
- no network calls of its own, no storage, no settings panel, no `@require` — `@grant none`
- does not touch the site's forms, search, or any listing's content

## How it differs from what is already here

One other script targets leolist.cc: a 2019 cookie-setter that suppresses a popunder library. Different concern entirely, zero overlap — and this script does not address popunders.

## Known limits

- A category with **no** listings renders completely stock. That is deliberate: there is nothing to show, and a blank column would be worse. (It used to render blank — fixed in 1.65.0.)
- Built and verified on Chromium with Violentmonkey. `:has()` is used, so Firefox 121+ should work, but is not measured.
- If leolist renames its card markup the script stops matching and the page renders **stock** — never mangled.

## Privacy

Zero requests, zero storage. The whole script is CSS plus DOM marking; read it.

## Source

Source, changelog and issues: https://github.com/izzykatt/userscripts — one file, no build, MIT.
