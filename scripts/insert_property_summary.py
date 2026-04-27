import re, sys
sys.stdout.reconfigure(encoding='utf-8')

PS = {
    "wymark":        ("RMs 107/136/137",   21951, 12753,  9198, 27930050,  7690, 126000570, ""),
    "ponteix":       ("RMs 75/76/77",      20016, 19697,   319,        0,  3555,  70022835, ""),
    "admiral":       ("RM 108",            10870,  2385,  8485,        0,  5218,  12444930, ""),
    "vanguard":      ("RMs 105/106",       44231, 14358, 29873,   444000,  5583,  80000694, ""),
    "outlook":       ("RMs 319/384",        6618,  1852,  4766, 39023000, 12927,  62968328, "Note: Property Summary RMs (319/384) differ from data.js's (Rudy 284, Montrose 315, Rosedale 283). Cross-check needed."),
    "kamsack":       ("RMs 271/273/301",   40245, 11377, 28868, 14171500,  6303,  85877958, "Note: Property Summary labels this row 'Kindersley' but RM numbers (Cote 271, Sliding Hills 273, St. Philips 301) match Kamsack's east-central SK location. Likely a label typo in the source doc."),
    "hafford":       ("RMs 435/437",       46466,  2554, 43912, 20291000,  5032,  33140665, "Property Summary 'Owned' (2,554) only counts Monette Farms Ltd. ISC titles split: Raptor 20,795 (Simmons-owned, confirmed 2026-04-25) + Monette Farms Ltd. 2,554 + Monette Ag Ventures Ltd. 1,104. Walter Farms reportedly bought ALL 46,466 ac; Monette to custom-farm 2026 under leaseback."),
    "prince-albert": ("RM 490",            20724,  3020, 17704,  4878508,  5745,  22229614, ""),
    "the-pas":       ("RM Kelsey",         28589, 21676,  6913,  6333000,  3752,  87661352, ""),
    "eddystone":     ("RM Alonsa",         21972, 26632,     0,  8500000,  2316,  70179712, "Note: Property Summary owned (26,632) > farmed (21,972). The 'owned' column likely counts total titled ac including pasture/non-cultivated. Edgelytone in source doc = Eddystone in data.js."),
    "montana":       ("Big Horn County",   77727, 53745, 23982, 12600091,  3000, 163661089, "Sum of 3 Big Horn County rows in Property Summary: Fly Creek 34,088 / Camp 1 14,827 / Camp 4 28,812 farmed."),
}

DATA_PATH = r'C:/Users/kyle/Agriculture/Monette/data.js'
with open(DATA_PATH, encoding='utf-8') as f:
    txt = f.read()

def fmt_block(ps):
    rm, farmed, owned, rented, repl, ppa, total, note = ps
    note_field = (',\n        note:' + repr(note)) if note else ''
    return (
        '\n      propertySummary:{\n'
        '        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",\n'
        '        rmArea:"' + rm + '",\n'
        '        farmedAc:' + str(farmed) + ',\n'
        '        ownedAc:' + str(owned) + ',\n'
        '        rentedAc:' + str(rented) + ',\n'
        '        buildingValue:' + str(repl) + ',\n'
        '        pricePerAc:' + str(ppa) + ',\n'
        '        totalValue:' + str(total)
        + note_field +
        '\n      },'
    )

def find_crops2024_end(text, start_idx):
    c24 = text.find('crops2024:[', start_idx)
    if c24 < 0:
        return -1
    depth = 1
    i = c24 + 11
    while i < len(text) and depth > 0:
        if text[i] == '[': depth += 1
        elif text[i] == ']': depth -= 1
        i += 1
    if i < len(text) and text[i] == ',':
        i += 1
    return i

inserted = []
for pid, ps_data in PS.items():
    block = fmt_block(ps_data)
    idx = txt.find('id:"' + pid + '"')
    if idx < 0:
        print('WARN: not found:', pid)
        continue
    insert_at = find_crops2024_end(txt, idx)
    if insert_at < 0:
        print('WARN: no crops2024 in', pid)
        continue
    txt = txt[:insert_at] + block + txt[insert_at:]
    inserted.append(pid)

print('Inserted propertySummary for ' + str(len(inserted)) + ': ' + ', '.join(inserted))

# Add new entries for cabri-bank and rosetown after calderbank
new_block = '''
    { id:"cabri-bank", name:"Cabri Bank", province:"SK", region:"South-West SK",
      lat:50.62, lng:-108.45,
      rms:["RM of Riverside No. 168","RM of Lacadena No. 228"],
      parcels:0, titled:17126, cultivated:0, waste:0, assessment:0,
      owned:17126, rented:215,
      soils:[],
      crops2025:[], crops2024:[],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RMs 65/96",
        farmedAc:17349,
        ownedAc:17126,
        rentedAc:215,
        buildingValue:2720000,
        pricePerAc:4572,
        totalValue:81029948,
        note:"NEW property added 2026-04-25. No per-property XLSX/PDF yet so no quarter-level geometry. Lat/lng + RM numbers approximated."
      },
      operator:"Monette",
      notes:"Court-file asset added from the Property Summary master holdings doc. Not yet in any per-property XLSX/PDF in our possession; awaiting tender package or ISC pull for quarter-level mapping. 17,349 farmed ac per Monette Property Summary." },
    { id:"rosetown", name:"Rosetown", province:"SK", region:"West-Central SK",
      lat:51.55, lng:-107.99,
      rms:["RM of St. Andrews No. 287","RM of Marriott No. 317","RM of Pleasant Valley No. 288"],
      parcels:0, titled:16530, cultivated:0, waste:0, assessment:0,
      owned:16530, rented:6727,
      soils:[],
      crops2025:[], crops2024:[],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RMs 219/250/279",
        farmedAc:23357,
        ownedAc:16530,
        rentedAc:6727,
        buildingValue:5500000,
        pricePerAc:5811,
        totalValue:101556760,
        note:"NEW property added 2026-04-25. No per-property XLSX/PDF yet so no quarter-level geometry. Lat/lng + RM numbers approximated."
      },
      operator:"Monette",
      notes:"Court-file asset added from the Property Summary master holdings doc. Not yet in any per-property XLSX/PDF in our possession; awaiting tender package or ISC pull for quarter-level mapping. 23,357 farmed ac per Monette Property Summary." },
'''

cal_idx = txt.find('id:"calderbank"')
if cal_idx > 0:
    open_idx = txt.rfind('{', 0, cal_idx)
    depth = 1
    i = open_idx + 1
    while i < len(txt) and depth > 0:
        if txt[i] == '{': depth += 1
        elif txt[i] == '}': depth -= 1
        i += 1
    if i < len(txt) and txt[i] == ',':
        i += 1
    if i < len(txt) and txt[i] == '\n':
        i += 1
    txt = txt[:i] + new_block + txt[i:]
    print('Inserted cabri-bank + rosetown after calderbank')

with open(DATA_PATH, 'w', encoding='utf-8') as f:
    f.write(txt)

ps_count = txt.count('propertySummary:{')
opens = txt.count('{')
closes = txt.count('}')
print('Final propertySummary blocks: ' + str(ps_count))
print('Brace balance: ' + str(opens) + ' opens, ' + str(closes) + ' closes, delta ' + str(opens - closes))
